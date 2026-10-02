from decimal import Decimal

import pytest

from apps.inventory.models import Product, StockLog

pytestmark = pytest.mark.django_db


def create_sku(as_warehouse, distributor, **overrides):
    payload = {
        "sku_code": "SKU-NEW-1",
        "name": "New Item",
        "unit_price": "19.99",
        "stock_qty": 40,
        "safety_stock": 5,
        "aisle": "B",
        "rack": "4",
        "shelf": "1",
        "bin": "7",
        **overrides,
    }
    return as_warehouse.post("/api/v1/inventory/", payload, format="json")


def test_warehouse_creates_sku(as_warehouse, distributor):
    resp = create_sku(as_warehouse, distributor)
    assert resp.status_code == 201, resp.json()
    body = resp.json()
    assert body["sku_code"] == "SKU-NEW-1"
    assert body["organization"] == distributor.id
    assert body["stock_qty"] == 0, "stock only moves through audited adjustments"
    assert body["location"] == "B-4-1-7"


def test_vendor_cannot_create_sku(as_vendor, distributor):
    resp = create_sku(as_vendor, distributor)
    assert resp.status_code == 403


def test_super_admin_can_create_sku_for_distributor(as_super_admin, distributor):
    resp = create_sku(as_super_admin, distributor, organization=distributor.id)
    assert resp.status_code == 201, resp.json()


def test_warehouse_cannot_create_sku_for_foreign_org(as_warehouse, vendor_org):
    resp = create_sku(as_warehouse, vendor_org, organization=vendor_org.id)
    assert resp.status_code in (400, 403), resp.json()


def test_duplicate_sku_rejected(as_warehouse, distributor):
    assert create_sku(as_warehouse, distributor).status_code == 201
    resp = create_sku(as_warehouse, distributor)
    assert resp.status_code == 400
    assert "sku_code" in str(resp.json())


def test_stock_adjustment_creates_audit_log(as_warehouse, product):
    resp = as_warehouse.patch(
        f"/api/v1/inventory/{product.id}/stock/",
        {"change_qty": 25, "reason": "STOCK_IN", "note": "supplier delivery"},
        format="json",
    )
    assert resp.status_code == 200
    assert resp.json()["stock_qty"] == 125

    log = StockLog.objects.get(product=product)
    assert log.change_qty == 25
    assert log.quantity_after == 125
    assert log.reason == StockLog.Reason.STOCK_IN
    assert log.user is not None
    assert log.created_at is not None


def test_negative_stock_adjustment_conflicts(as_warehouse, product):
    resp = as_warehouse.patch(
        f"/api/v1/inventory/{product.id}/stock/", {"change_qty": -101, "reason": "DAMAGED"}, format="json"
    )
    assert resp.status_code == 409
    product.refresh_from_db()
    assert product.stock_qty == 100
    assert StockLog.objects.count() == 0


def test_vendor_cannot_adjust_stock(as_vendor, product):
    resp = as_vendor.patch(
        f"/api/v1/inventory/{product.id}/stock/", {"change_qty": 1, "reason": "STOCK_IN"}, format="json"
    )
    assert resp.status_code == 403


def test_listing_supports_search_and_pagination(as_warehouse, product, distributor):
    for i in range(15):
        Product.objects.create(
            sku_code=f"BULK-{i:03d}", name=f"Bulk item {i}", organization=distributor, unit_price=Decimal("1.00")
        )

    page1 = as_warehouse.get("/api/v1/inventory/").json()
    assert page1["count"] == 16
    assert len(page1["results"]) == 10
    assert page1["next"] is not None

    page2 = as_warehouse.get("/api/v1/inventory/?page=2").json()
    assert len(page2["results"]) == 6

    search = as_warehouse.get("/api/v1/inventory/?search=SKU-001").json()
    assert search["count"] == 1
    assert search["results"][0]["sku_code"] == "SKU-001"


def test_low_stock_filter(as_warehouse, product, distributor):
    Product.objects.create(
        sku_code="LOW-1", name="Low", organization=distributor, unit_price=Decimal("1.00"), stock_qty=2, safety_stock=5
    )
    resp = as_warehouse.get("/api/v1/inventory/?low_stock=true").json()
    assert resp["count"] == 1
    assert resp["results"][0]["sku_code"] == "LOW-1"


def test_summary_endpoint(as_warehouse, product, distributor):
    Product.objects.create(
        sku_code="LOW-1", name="Low", organization=distributor, unit_price=Decimal("4.00"), stock_qty=1, safety_stock=5
    )
    body = as_warehouse.get("/api/v1/inventory/summary/").json()
    assert body["total_skus"] == 2
    assert body["low_stock_count"] == 1
    assert body["out_of_stock_count"] == 0
    assert Decimal(body["stock_value"]) == Decimal("100.00") * Decimal("10.00") + Decimal("4.00")


def test_deactivate_sku_hides_from_vendors(as_warehouse, as_vendor, product):
    resp = as_warehouse.delete(f"/api/v1/inventory/{product.id}/")
    assert resp.status_code in (200, 204)
    product.refresh_from_db()
    assert product.is_active is False
    assert as_vendor.get("/api/v1/inventory/").json()["count"] == 0


def test_stock_log_visibility_restricted_to_warehouse(as_warehouse, as_vendor, product):
    as_warehouse.patch(
        f"/api/v1/inventory/{product.id}/stock/", {"change_qty": 5, "reason": "STOCK_IN"}, format="json"
    )
    assert as_warehouse.get("/api/v1/stock-logs/").json()["count"] == 1
    assert as_vendor.get("/api/v1/stock-logs/").status_code == 403


def test_warehouse_scoped_to_own_products(as_warehouse, as_super_admin, distributor, vendor_org):
    """A warehouse manager only manages its distributor's catalog."""
    Product.objects.create(
        sku_code="OTHER-1", name="Other", organization=vendor_org, unit_price=Decimal("1.00")
    )
    listing = as_warehouse.get("/api/v1/inventory/").json()
    assert listing["count"] == 0
    assert as_super_admin.get("/api/v1/inventory/").json()["count"] == 1
