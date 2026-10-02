"""Atomic bulk checkout engine (FR-ORD-1, FR-ORD-2, FR-ORD-3)."""

from decimal import Decimal

from django.db import transaction

from apps.core.exceptions import ConflictError
from apps.inventory.models import Product, StockLog
from apps.orders.models import Order, OrderItem


def unit_price_for(product: Product, quantity: int) -> Decimal:
    if product.wholesale_price is not None and quantity >= product.wholesale_min_qty:
        return product.wholesale_price
    return product.unit_price


def checkout(*, user, items: list[dict], shipping_address: str = "", notes: str = "") -> Order:
    """Validate every line item and deduct stock under row-level locks.

    The whole operation runs in one database transaction. `select_for_update()`
    locks every touched product row in a deterministic (ascending id) order, so
    concurrent checkouts on the same low-stock SKU serialize instead of racing.
    Any shortage aborts the transaction and raises a 409 Conflict carrying
    item-level error details.
    """
    requested: dict[int, int] = {}
    for item in items:
        pid = int(item["product_id"])
        requested[pid] = requested.get(pid, 0) + int(item["quantity"])

    with transaction.atomic():
        product_ids = sorted(requested)
        # Lock every candidate row in ascending id order (deterministic lock
        # ordering prevents deadlocks between concurrent checkouts). Visibility
        # is evaluated separately because `SELECT ... FOR UPDATE` cannot be
        # combined with the DISTINCT clause used by the tenant-scope filter.
        locked_products = list(
            Product.objects.select_for_update().filter(id__in=product_ids).order_by("id")
        )
        visible_ids = set(
            Product.objects.visible_to(user).filter(id__in=product_ids).values_list("id", flat=True)
        )
        product_map = {p.id: p for p in locked_products if p.id in visible_ids}

        errors: list[dict] = []
        for pid in product_ids:
            quantity = requested[pid]
            product = product_map.get(pid)
            if product is None:
                errors.append(
                    {
                        "product_id": pid,
                        "sku_code": None,
                        "requested": quantity,
                        "available": 0,
                        "message": "Product not found or not available for your organization.",
                    }
                )
                continue
            if quantity <= 0:
                errors.append(
                    {
                        "product_id": pid,
                        "sku_code": product.sku_code,
                        "requested": quantity,
                        "available": product.stock_qty,
                        "message": "Quantity must be at least 1.",
                    }
                )
            elif quantity > product.stock_qty:
                errors.append(
                    {
                        "product_id": pid,
                        "sku_code": product.sku_code,
                        "requested": quantity,
                        "available": product.stock_qty,
                        "message": f"Insufficient stock for {product.sku_code}: "
                        f"requested {quantity}, available {product.stock_qty}.",
                    }
                )

        if errors:
            raise ConflictError(
                detail="One or more items could not be fulfilled. The order was rolled back.",
                errors=errors,
            )

        order = Order.objects.create(
            vendor_id=user.organization_id,
            placed_by=user,
            shipping_address=shipping_address,
            notes=notes,
            status=Order.Status.PENDING,
        )
        order.order_number = f"PO-{order.pk:06d}"
        total = Decimal("0")
        count = 0

        for pid in product_ids:
            quantity = requested[pid]
            product = product_map[pid]
            price = unit_price_for(product, quantity)
            OrderItem.objects.create(
                order=order,
                product=product,
                quantity=quantity,
                price_at_purchase=price,
            )
            product.stock_qty -= quantity
            product.save(update_fields=["stock_qty", "updated_at"])
            StockLog.objects.create(
                product=product,
                change_qty=-quantity,
                quantity_after=product.stock_qty,
                reason=StockLog.Reason.ORDER,
                note=f"Order {order.order_number}",
                user=user,
            )
            total += price * quantity
            count += 1

        order.total_amount = total
        order.item_count = count
        order.save(update_fields=["order_number", "total_amount", "item_count", "updated_at"])

        for product in locked_products:
            if product.pk in product_map and product.is_low_stock:
                transaction.on_commit(lambda pk=product.pk: _queue_low_stock(pk))

    return order


def _queue_low_stock(product_id: int) -> None:
    from apps.inventory.tasks import low_stock_workflow

    low_stock_workflow.delay(product_id)
