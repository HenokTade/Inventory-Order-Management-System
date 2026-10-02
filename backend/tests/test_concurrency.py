"""Concurrent checkout tests proving row-level locking behaviour (FR-ORD-2/3).

These use real threads against PostgreSQL so that `select_for_update()` locks
are actually exercised — a non-locking implementation would oversell stock and
fail these tests.
"""

import threading

import pytest
from django.db import connections
from rest_framework.test import APIClient

from apps.inventory.models import Product, StockLog
from apps.orders.models import Order

pytestmark = pytest.mark.django_db(transaction=True)

THREAD_TIMEOUT = 30


def _run_concurrently(fns):
    """Run callables in parallel threads; fail loudly on hangs (deadlocks)."""
    barrier = threading.Barrier(len(fns), timeout=THREAD_TIMEOUT)
    results = [None] * len(fns)
    errors = [None] * len(fns)

    def runner(index, fn):
        try:
            barrier.wait()
            results[index] = fn()
        except Exception as exc:  # noqa: BLE001 - surfaced via assertion below
            errors[index] = exc
        finally:
            connections.close_all()

    threads = [threading.Thread(target=runner, args=(i, fn)) for i, fn in enumerate(fns)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=THREAD_TIMEOUT)

    alive = [t for t in threads if t.is_alive()]
    assert not alive, f"{len(alive)} checkout thread(s) hung — likely a lock deadlock"
    assert errors == [None] * len(fns), f"thread raised: {errors}"
    return results


def _client_for(user) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


def _post_checkout(user, items, **extra):
    def call():
        client = _client_for(user)
        return client.post(
            "/api/v1/orders/checkout/",
            {"items": [{"product_id": pid, "quantity": qty} for pid, qty in items], **extra},
            format="json",
        )

    return call


def test_concurrent_checkout_on_low_stock_has_exactly_one_winner(product, vendor_user):
    """Two simultaneous orders of 8 units against 10 in stock: one 201, one 409."""
    product.stock_qty = 10
    product.save(update_fields=["stock_qty"])

    responses = _run_concurrently(
        [
            _post_checkout(vendor_user, [(product.id, 8)], shipping_address="1 Main St"),
            _post_checkout(vendor_user, [(product.id, 8)], shipping_address="2 Main St"),
        ]
    )

    statuses = sorted(r.status_code for r in responses)
    assert statuses == [201, 409], f"expected one winner and one conflict, got {statuses}"

    winner = next(r for r in responses if r.status_code == 201)
    loser = next(r for r in responses if r.status_code == 409)

    error = loser.json()["error"]
    assert error["code"] == "conflict"
    item_error = error["errors"][0]
    assert item_error["product_id"] == product.id
    assert item_error["requested"] == 8
    assert item_error["available"] in (2, 10)

    product.refresh_from_db()
    assert product.stock_qty == 2, "only the winning order may deduct stock"

    assert Order.objects.count() == 1
    assert winner.json()["order_number"] == Order.objects.get().order_number

    deduction = StockLog.objects.get(product=product, reason=StockLog.Reason.ORDER)
    assert deduction.change_qty == -8
    assert deduction.quantity_after == 2


def test_three_way_race_sells_available_stock_only(product, vendor_user):
    """Three simultaneous orders of 4 against 10 units: max 2 can win (4+4 <= 10)."""
    product.stock_qty = 10
    product.save(update_fields=["stock_qty"])

    responses = _run_concurrently(
        [_post_checkout(vendor_user, [(product.id, 4)]) for _ in range(3)]
    )

    statuses = sorted(r.status_code for r in responses)
    assert statuses.count(201) == 2, f"exactly two orders fit in stock, got {statuses}"
    assert statuses.count(409) == 1

    product.refresh_from_db()
    assert product.stock_qty == 2
    assert Order.objects.count() == 2
    assert StockLog.objects.filter(product=product, reason=StockLog.Reason.ORDER).count() == 2


def test_multi_item_concurrent_checkouts_do_not_deadlock(product, distributor, vendor_user, vendor_user_2):
    """Opposite insertion orders must serialize cleanly thanks to sorted locks."""
    product.stock_qty = 10
    product.save(update_fields=["stock_qty"])
    other = Product.objects.create(
        sku_code="SKU-002",
        name="Gadget",
        organization=distributor,
        unit_price=5,
        stock_qty=10,
        safety_stock=1,
    )

    responses = _run_concurrently(
        [
            _post_checkout(vendor_user, [(product.id, 3), (other.id, 3)]),
            _post_checkout(vendor_user_2, [(other.id, 3), (product.id, 3)]),
        ]
    )

    statuses = sorted(r.status_code for r in responses)
    assert statuses == [201, 201], f"both should succeed sequentially, got {statuses}"

    product.refresh_from_db()
    other.refresh_from_db()
    assert product.stock_qty == 4, "10 - 3 - 3"
    assert other.stock_qty == 4, "10 - 3 - 3"
    assert Order.objects.count() == 2


def test_concurrent_stock_adjustment_never_goes_negative(product, warehouse_user, vendor_user):
    """Row lock serializes checkout vs. manual adjustment on the same SKU."""

    def adjust():
        client = _client_for(warehouse_user)
        return client.patch(
            f"/api/v1/inventory/{product.id}/stock/",
            {"change_qty": -95, "reason": "DAMAGED"},
            format="json",
        )

    responses = _run_concurrently(
        [
            adjust,
            _post_checkout(vendor_user, [(product.id, 10)]),
        ]
    )
    statuses = sorted(r.status_code for r in responses)
    # Whichever runs first consumes/locks the stock; the loser gets a 409:
    #   adjust first -> 5 left, checkout of 10 conflicts  (200, 409)
    #   checkout first -> 90 left, -95 adjustment conflicts (201, 409)
    assert 409 in statuses, f"exactly one operation must lose the race, got {statuses}"
    assert len(statuses) == 2

    product.refresh_from_db()
    assert product.stock_qty >= 0, "stock may never go negative"
    assert product.stock_qty in (5, 90)

    total_change = sum(log.change_qty for log in StockLog.objects.filter(product=product))
    assert 100 + total_change == product.stock_qty, "audit log must reconcile with stock"
