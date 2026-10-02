from datetime import timedelta
from decimal import Decimal
from io import BytesIO

import pytest
from django.core import mail
from django.utils import timezone

from apps.invoices.models import Invoice
from apps.invoices.tasks import mark_overdue_invoices
from apps.orders.models import Order
from tests.helpers import capture_on_commit_callbacks

pytestmark = pytest.mark.django_db


def place_and_confirm(as_vendor, as_warehouse, product, qty=2):
    order_id = as_vendor.post(
        "/api/v1/orders/checkout/", {"items": [{"product_id": product.id, "quantity": qty}]}, format="json"
    ).json()["id"]
    with capture_on_commit_callbacks(execute=True):
        resp = as_warehouse.patch(f"/api/v1/orders/{order_id}/status/", {"status": "CONFIRMED"}, format="json")
    assert resp.status_code == 200
    return order_id


def test_confirmation_generates_invoice_with_tax_and_net30(as_vendor, as_warehouse, product):
    order_id = place_and_confirm(as_vendor, as_warehouse, product, qty=2)

    invoice = Invoice.objects.get(order_id=order_id)
    assert invoice.invoice_number == f"INV-{order_id:06d}"
    assert invoice.status == Invoice.Status.UNPAID
    assert invoice.payment_terms == "Net 30"
    assert invoice.issue_date == timezone.localdate()
    assert invoice.due_date == timezone.localdate() + timedelta(days=30)
    assert invoice.subtotal == Decimal("20.00")
    assert invoice.tax_rate == Decimal("0.15")
    assert invoice.tax_amount == Decimal("3.00")
    assert invoice.total_amount == Decimal("23.00")


def test_confirmation_kicks_off_pdf_generation_and_email(as_vendor, as_warehouse, product):
    order_id = place_and_confirm(as_vendor, as_warehouse, product, qty=2)
    invoice = Invoice.objects.get(order_id=order_id)

    assert invoice.pdf_file, "Celery task must persist the generated PDF"
    with invoice.pdf_file.open("rb") as fh:
        content = fh.read()
    assert content.startswith(b"%PDF"), "file must be a real PDF"

    assert len(mail.outbox) >= 1, "vendor must be emailed the invoice"
    assert any(invoice.invoice_number in m.subject for m in mail.outbox)


def test_invoice_pdf_endpoint_returns_pdf(as_vendor, as_warehouse, product):
    order_id = place_and_confirm(as_vendor, as_warehouse, product, qty=2)
    invoice = Invoice.objects.get(order_id=order_id)

    resp = as_vendor.get(f"/api/v1/invoices/{invoice.id}/pdf/")
    assert resp.status_code == 200
    assert resp["Content-Type"] == "application/pdf"
    body = b"".join(resp.streaming_content)
    assert body.startswith(b"%PDF")


def test_vendor_submits_payment_reference_and_proof(as_vendor, as_warehouse, product):
    order_id = place_and_confirm(as_vendor, as_warehouse, product, qty=2)
    invoice = Invoice.objects.get(order_id=order_id)

    resp = as_vendor.post(
        f"/api/v1/invoices/{invoice.id}/pay/",
        {"payment_reference": "TXN-998877"},
        format="json",
    )
    assert resp.status_code == 200, resp.json()
    invoice.refresh_from_db()
    assert invoice.status == Invoice.Status.PAYMENT_SUBMITTED
    assert invoice.payment_reference == "TXN-998877"

    again = as_vendor.post(f"/api/v1/invoices/{invoice.id}/pay/", {"payment_reference": "X"}, format="json")
    assert again.status_code == 409


def test_payment_proof_upload(as_vendor, product, as_warehouse):
    from django.core.files.uploadedfile import SimpleUploadedFile

    order_id = place_and_confirm(as_vendor, as_warehouse, product, qty=2)
    invoice = Invoice.objects.get(order_id=order_id)

    proof = SimpleUploadedFile("receipt.png", b"fake-receipt-bytes", content_type="image/png")
    resp = as_vendor.post(
        f"/api/v1/invoices/{invoice.id}/pay/",
        {"payment_reference": "RECEIPT-1", "proof_of_payment": proof},
        format="multipart",
    )
    assert resp.status_code == 200
    invoice.refresh_from_db()
    assert invoice.proof_of_payment
    assert invoice.proof_of_payment.name.startswith("proofs/")


def test_warehouse_verifies_payment(as_vendor, as_warehouse, product):
    order_id = place_and_confirm(as_vendor, as_warehouse, product, qty=2)
    invoice = Invoice.objects.get(order_id=order_id)
    as_vendor.post(f"/api/v1/invoices/{invoice.id}/pay/", {"payment_reference": "TXN-1"}, format="json")

    resp = as_warehouse.patch(f"/api/v1/invoices/{invoice.id}/status/", {"status": "PAID"}, format="json")
    assert resp.status_code == 200
    invoice.refresh_from_db()
    assert invoice.status == Invoice.Status.PAID
    assert invoice.paid_at is not None


def test_vendor_cannot_verify_payments(as_vendor, as_warehouse, product):
    order_id = place_and_confirm(as_vendor, as_warehouse, product, qty=2)
    invoice = Invoice.objects.get(order_id=order_id)
    resp = as_vendor.patch(f"/api/v1/invoices/{invoice.id}/status/", {"status": "PAID"}, format="json")
    assert resp.status_code == 403


def test_invoices_are_tenant_scoped(as_vendor, as_vendor_2, as_warehouse, product):
    order_id = place_and_confirm(as_vendor, as_warehouse, product, qty=1)
    invoice = Invoice.objects.get(order_id=order_id)

    assert as_vendor.get(f"/api/v1/invoices/{invoice.id}/").status_code == 200
    assert as_warehouse.get(f"/api/v1/invoices/{invoice.id}/").status_code == 200
    assert as_vendor_2.get(f"/api/v1/invoices/{invoice.id}/").status_code == 404
    assert as_vendor_2.get("/api/v1/invoices/").json()["count"] == 0


def test_unpaid_invoice_stays_open_listed_for_vendor(as_vendor, as_warehouse, product):
    place_and_confirm(as_vendor, as_warehouse, product, qty=1)
    listing = as_vendor.get("/api/v1/invoices/?status=UNPAID").json()
    assert listing["count"] == 1
    assert listing["results"][0]["status"] == Invoice.Status.UNPAID


def test_overdue_scan_marks_late_invoices(as_vendor, as_warehouse, product):
    order_id = place_and_confirm(as_vendor, as_warehouse, product, qty=1)
    invoice = Invoice.objects.get(order_id=order_id)
    Invoice.objects.filter(pk=invoice.pk).update(due_date=timezone.localdate() - timedelta(days=1))

    result = mark_overdue_invoices()
    assert result == {"marked_overdue": 1}
    invoice.refresh_from_db()
    assert invoice.status == Invoice.Status.OVERDUE


def test_low_stock_checkout_queues_restock_and_notifies_warehouse(as_vendor, as_warehouse, warehouse_user, product):
    from apps.inventory.models import RestockOrder

    product.stock_qty = 12
    product.safety_stock = 10
    product.save(update_fields=["stock_qty", "safety_stock"])

    with capture_on_commit_callbacks(execute=True):
        resp = as_vendor.post(
            "/api/v1/orders/checkout/", {"items": [{"product_id": product.id, "quantity": 5}]}, format="json"
        )
    assert resp.status_code == 201

    product.refresh_from_db()
    assert product.stock_qty == 7, "below safety stock of 10"

    restock = RestockOrder.objects.get(product=product)
    assert restock.status == RestockOrder.Status.DRAFT
    assert restock.threshold == 10
    assert restock.trigger_stock == 7
    assert restock.quantity >= 10

    assert any("Low Stock" in m.subject for m in mail.outbox)
    assert any(warehouse_user.email in m.to for m in mail.outbox)


def test_stock_adjustment_below_threshold_triggers_workflow(as_warehouse, warehouse_user, product):
    from apps.inventory.models import RestockOrder

    product.stock_qty = 20
    product.safety_stock = 15
    product.save(update_fields=["stock_qty", "safety_stock"])

    with capture_on_commit_callbacks(execute=True):
        resp = as_warehouse.patch(
            f"/api/v1/inventory/{product.id}/stock/",
            {"new_quantity": 5, "reason": "DAMAGED", "note": "water damage"},
            format="json",
        )
    assert resp.status_code == 200
    assert resp.json()["stock_qty"] == 5

    assert RestockOrder.objects.filter(product=product, status="DRAFT").exists()
    assert any("Low Stock" in m.subject for m in mail.outbox)


def test_receiving_restock_order_increases_stock(as_warehouse, product):
    from apps.inventory.models import RestockOrder, StockLog

    restock = RestockOrder.objects.create(
        product=product, quantity=50, trigger_stock=5, threshold=10, status=RestockOrder.Status.DRAFT
    )
    resp = as_warehouse.patch(f"/api/v1/restocks/{restock.id}/", {"status": "RECEIVED"}, format="json")
    assert resp.status_code == 200

    product.refresh_from_db()
    assert product.stock_qty == 150
    log = StockLog.objects.get(product=product, reason=StockLog.Reason.RESTOCK_RECEIVED)
    assert log.change_qty == 50
    assert log.quantity_after == 150


def test_order_listing_reports_allowed_transitions(as_vendor, as_warehouse, product):
    order_id = place_and_confirm(as_vendor, as_warehouse, product, qty=1)
    body = as_vendor.get(f"/api/v1/orders/{order_id}/").json()
    assert body["status"] == Order.Status.CONFIRMED
    assert set(body["allowed_transitions"]) == {"PROCESSING", "CANCELLED"}
    assert body["invoice_id"] is not None
