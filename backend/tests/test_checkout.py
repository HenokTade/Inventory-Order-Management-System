from decimal import Decimal

import pytest
from django.db.models.deletion import ProtectedError

from apps.inventory.models import Product, StockLog
from apps.orders.models import Order

pytestmark = pytest.mark.django_db


def checkout_payload(*items, **extra):
    return {"items": [{"product_id": pid, "quantity": qty} for pid, qty in items], **extra}


def test_checkout_is_atomic_and_deducts_stock(as_vendor, vendor_user, product):
    resp = as_vendor.post(
        "/api/v1/orders/checkout/",
        checkout_payload((product.id, 5), shipping_address="1 Warehouse Rd"),
        format="json",
    )
    assert resp.status_code == 201, resp.json()
    body = resp.json()
    assert body["status"] == Order.Status.PENDING
    assert body["item_count"] == 1
    assert Decimal(body["total_amount"]) == Decimal("50.00")
    assert body["items"][0]["price_at_purchase"] == "10.00"

    product.refresh_from_db()
    assert product.stock_qty == 95

    log = StockLog.objects.get(product=product)
    assert log.change_qty == -5
    assert log.quantity_after == 95
    assert log.reason == StockLog.Reason.ORDER
    assert log.user_id == vendor_user.id


def test_checkout_applies_wholesale_price_for_bulk_quantity(as_vendor, product):
    resp = as_vendor.post("/api/v1/orders/checkout/", checkout_payload((product.id, 10)), format="json")
    assert resp.status_code == 201
    assert Decimal(resp.json()["items"][0]["price_at_purchase"]) == Decimal("8.00")
    assert Decimal(resp.json()["total_amount"]) == Decimal("80.00")


def test_checkout_insufficient_stock_returns_409_and_rolls_back(as_vendor, product):
    resp = as_vendor.post("/api/v1/orders/checkout/", checkout_payload((product.id, 500)), format="json")
    assert resp.status_code == 409
    error = resp.json()["error"]
    assert error["code"] == "conflict"
    assert error["errors"][0]["product_id"] == product.id
    assert error["errors"][0]["requested"] == 500
    assert error["errors"][0]["available"] == 100
    assert "requested 500, available 100" in error["errors"][0]["message"]

    product.refresh_from_db()
    assert product.stock_qty == 100
    assert Order.objects.count() == 0
    assert StockLog.objects.count() == 0


def test_checkout_multi_item_partial_failure_rolls_back_everything(as_vendor, product, distributor):
    other = Product.objects.create(
        sku_code="SKU-002",
        name="Gadget",
        organization=distributor,
        unit_price=Decimal("5.00"),
        stock_qty=3,
        safety_stock=1,
    )
    resp = as_vendor.post(
        "/api/v1/orders/checkout/",
        checkout_payload((product.id, 2), (other.id, 10)),
        format="json",
    )
    assert resp.status_code == 409
    errors = resp.json()["error"]["errors"]
    assert len(errors) == 1
    assert errors[0]["product_id"] == other.id

    product.refresh_from_db()
    other.refresh_from_db()
    assert product.stock_qty == 100, "healthy SKU must not be deducted when the batch fails"
    assert other.stock_qty == 3
    assert Order.objects.count() == 0
    assert StockLog.objects.count() == 0


def test_checkout_unknown_product_returns_409(as_vendor, product):
    resp = as_vendor.post("/api/v1/orders/checkout/", checkout_payload((99999, 1)), format="json")
    assert resp.status_code == 409
    assert "not found" in resp.json()["error"]["errors"][0]["message"].lower()


def test_checkout_requires_vendor_role(as_warehouse, product):
    resp = as_warehouse.post("/api/v1/orders/checkout/", checkout_payload((product.id, 1)), format="json")
    assert resp.status_code == 403


def test_duplicate_lines_are_merged(as_vendor, product):
    resp = as_vendor.post(
        "/api/v1/orders/checkout/",
        {"items": [{"product_id": product.id, "quantity": 2}, {"product_id": product.id, "quantity": 3}]},
        format="json",
    )
    assert resp.status_code == 201
    body = resp.json()
    assert len(body["items"]) == 1
    assert body["items"][0]["quantity"] == 5


def test_orders_are_scoped_by_tenant(as_vendor, as_vendor_2, as_warehouse, product, vendor_user):
    as_vendor.post("/api/v1/orders/checkout/", checkout_payload((product.id, 1)), format="json")

    vendor2_orders = as_vendor_2.get("/api/v1/orders/").json()
    assert vendor2_orders["count"] == 0

    vendor1_orders = as_vendor.get("/api/v1/orders/").json()
    assert vendor1_orders["count"] == 1

    warehouse_orders = as_warehouse.get("/api/v1/orders/").json()
    assert warehouse_orders["count"] == 1

    other_order_detail = as_vendor_2.get(f"/api/v1/orders/{Order.objects.first().id}/")
    assert other_order_detail.status_code == 404


def test_status_workflow_progression(as_vendor, as_warehouse, product):
    order_id = as_vendor.post("/api/v1/orders/checkout/", checkout_payload((product.id, 2)), format="json").json()[
        "id"
    ]

    for next_status in ("CONFIRMED", "PROCESSING", "DISPATCHED", "DELIVERED"):
        resp = as_warehouse.patch(f"/api/v1/orders/{order_id}/status/", {"status": next_status}, format="json")
        assert resp.status_code == 200, resp.json()
        assert resp.json()["status"] == next_status


def test_invalid_status_transition_conflicts(as_vendor, as_warehouse, product):
    order_id = as_vendor.post("/api/v1/orders/checkout/", checkout_payload((product.id, 2)), format="json").json()[
        "id"
    ]
    resp = as_warehouse.patch(f"/api/v1/orders/{order_id}/status/", {"status": "DELIVERED"}, format="json")
    assert resp.status_code == 409
    allowed = resp.json()["error"]["errors"][0]["allowed"]
    assert Order.Status.CONFIRMED in allowed
    assert Order.Status.CANCELLED in allowed


def test_vendor_cannot_advance_status(as_vendor, product):
    order_id = as_vendor.post("/api/v1/orders/checkout/", checkout_payload((product.id, 2)), format="json").json()[
        "id"
    ]
    resp = as_vendor.patch(f"/api/v1/orders/{order_id}/status/", {"status": "CONFIRMED"}, format="json")
    assert resp.status_code == 403


def test_vendor_can_cancel_own_pending_order_and_stock_returns(as_vendor, product):
    order_id = as_vendor.post("/api/v1/orders/checkout/", checkout_payload((product.id, 4)), format="json").json()[
        "id"
    ]
    product.refresh_from_db()
    assert product.stock_qty == 96

    resp = as_vendor.patch(f"/api/v1/orders/{order_id}/status/", {"status": "CANCELLED"}, format="json")
    assert resp.status_code == 200

    product.refresh_from_db()
    assert product.stock_qty == 100
    restore_log = StockLog.objects.filter(product=product, reason=StockLog.Reason.ORDER_CANCELLED).get()
    assert restore_log.change_qty == 4


def test_vendor_cannot_cancel_confirmed_order(as_vendor, as_warehouse, product):
    order_id = as_vendor.post("/api/v1/orders/checkout/", checkout_payload((product.id, 2)), format="json").json()[
        "id"
    ]
    as_warehouse.patch(f"/api/v1/orders/{order_id}/status/", {"status": "CONFIRMED"}, format="json")
    resp = as_vendor.patch(f"/api/v1/orders/{order_id}/status/", {"status": "CANCELLED"}, format="json")
    assert resp.status_code == 403, "vendors may only cancel orders still in PENDING"


def test_warehouse_cancellation_restocks_and_voids_invoice(as_vendor, as_warehouse, product):
    from apps.invoices.models import Invoice

    order_id = as_vendor.post("/api/v1/orders/checkout/", checkout_payload((product.id, 3)), format="json").json()[
        "id"
    ]
    as_warehouse.patch(f"/api/v1/orders/{order_id}/status/", {"status": "CONFIRMED"}, format="json")
    assert Invoice.objects.filter(order_id=order_id).exists()

    resp = as_warehouse.patch(f"/api/v1/orders/{order_id}/status/", {"status": "CANCELLED"}, format="json")
    assert resp.status_code == 200

    product.refresh_from_db()
    assert product.stock_qty == 100
    assert Invoice.objects.get(order_id=order_id).status == Invoice.Status.VOID
    assert StockLog.objects.filter(product=product, reason=StockLog.Reason.ORDER_CANCELLED).exists()


def test_cancellation_conflicts_once_invoice_is_paid(as_vendor, as_warehouse, product):
    from apps.invoices.models import Invoice

    order_id = as_vendor.post("/api/v1/orders/checkout/", checkout_payload((product.id, 2)), format="json").json()[
        "id"
    ]
    as_warehouse.patch(f"/api/v1/orders/{order_id}/status/", {"status": "CONFIRMED"}, format="json")
    invoice = Invoice.objects.get(order_id=order_id)
    as_warehouse.patch(f"/api/v1/invoices/{invoice.id}/status/", {"status": "PAID"}, format="json")

    resp = as_warehouse.patch(f"/api/v1/orders/{order_id}/status/", {"status": "CANCELLED"}, format="json")
    assert resp.status_code == 409
    product.refresh_from_db()
    assert product.stock_qty == 98, "stock must remain deducted for a paid order"


def test_product_delete_is_protected_by_referencing_records(as_warehouse, product, as_vendor):
    as_vendor.post("/api/v1/orders/checkout/", checkout_payload((product.id, 1)), format="json")
    with pytest.raises(ProtectedError):
        product.delete()


def test_inactive_product_disappears_from_vendor_catalog(as_vendor, as_warehouse, product):
    product.is_active = False
    product.save(update_fields=["is_active", "updated_at"])
    listing = as_vendor.get("/api/v1/inventory/").json()
    assert listing["count"] == 0
    assert as_warehouse.get("/api/v1/inventory/").json()["count"] == 1
