import pytest
from django.core.files.base import ContentFile

from apps.core.media import sign_media_url
from apps.core.storage import DatabaseStorage
from apps.invoices.models import Invoice
from apps.invoices.serializers import InvoiceSerializer
from tests.test_invoices import place_and_confirm

pytestmark = pytest.mark.django_db


def test_database_storage_roundtrip(db):
    storage = DatabaseStorage()
    name = storage.save("invoices/unit-test.pdf", ContentFile(b"%PDF-1.4 unit"))

    assert storage.exists(name)
    assert storage.size(name) == len(b"%PDF-1.4 unit")
    with storage.open(name, "rb") as handle:
        assert handle.read() == b"%PDF-1.4 unit"
    assert storage.url(name).startswith("/media/")

    storage.delete(name)
    assert not storage.exists(name)


def test_media_endpoint_only_serves_signed_files(client):
    from django.core.files.storage import default_storage

    name = default_storage.save("invoices/demo.pdf", ContentFile(b"%PDF-1.4 demo"))

    signed = sign_media_url(name)
    resp = client.get(signed)
    assert resp.status_code == 200
    assert b"".join(resp.streaming_content).startswith(b"%PDF-1.4")

    token = signed.split("token=")[1]
    assert client.get(f"/media/{name}").status_code == 404
    assert client.get(f"/media/invoices/other.pdf?token={token}").status_code == 404
    assert client.get(f"/media/invoices/missing.pdf?token={token}").status_code == 404


def test_invoice_pdf_url_is_signed_and_downloadable(as_vendor, as_warehouse, product):
    order_id = place_and_confirm(as_vendor, as_warehouse, product)
    invoice = Invoice.objects.get(order_id=order_id)

    payload = InvoiceSerializer(invoice).data
    assert payload["pdf_url"].startswith("/media/invoices/")
    assert "token=" in payload["pdf_url"]
    assert payload["proof_url"] is None

    resp = as_vendor.get(payload["pdf_url"])
    assert resp.status_code == 200
    assert b"".join(resp.streaming_content).startswith(b"%PDF")


def test_cron_endpoint_enforces_secret_and_runs_tasks(client, monkeypatch):
    monkeypatch.setenv("CRON_SECRET", "cron-secret-value")

    assert client.get("/api/v1/cron/run/").status_code == 401
    assert client.get("/api/v1/cron/run/", HTTP_AUTHORIZATION="Bearer wrong").status_code == 401

    resp = client.get("/api/v1/cron/run/", HTTP_AUTHORIZATION="Bearer cron-secret-value")
    assert resp.status_code == 200
    body = resp.json()
    assert body["overdue"] == {"marked_overdue": 0}
    assert body["low_stock"] == {"scanned": 0}
    assert "analytics" in body


def test_cron_endpoint_is_closed_without_configured_secret(client, monkeypatch, settings):
    monkeypatch.delenv("CRON_SECRET", raising=False)
    settings.DEBUG = False

    assert client.get("/api/v1/cron/run/").status_code == 401
