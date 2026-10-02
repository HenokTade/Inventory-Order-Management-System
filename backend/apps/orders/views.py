from django.db import transaction
from django.db.models import Prefetch, Q
from rest_framework import mixins, status as http_status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsVendor, IsWarehouseManagerOrSuperAdmin
from apps.core.exceptions import ConflictError
from apps.inventory.models import Product, StockLog
from apps.orders.models import Order, OrderItem
from apps.orders.serializers import CheckoutSerializer, OrderSerializer, OrderStatusSerializer


class CheckoutView(APIView):
    """Atomic bulk purchase order placement (FR-ORD-1..3)."""

    permission_classes = [IsVendor]

    def post(self, request):
        serializer = CheckoutSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        order = serializer.save()
        order = (
            Order.objects.filter(pk=order.pk)
            .select_related("vendor", "placed_by")
            .prefetch_related(Prefetch("items", queryset=OrderItem.objects.select_related("product")))
            .get()
        )
        return Response(OrderSerializer(order).data, status=http_status.HTTP_201_CREATED)


class OrderViewSet(mixins.RetrieveModelMixin, mixins.ListModelMixin, viewsets.GenericViewSet):
    serializer_class = OrderSerializer
    filterset_fields = ["status", "vendor"]
    search_fields = ["order_number"]
    ordering_fields = ["created_at", "total_amount", "status"]
    ordering = ["-created_at"]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = (
            Order.objects.select_related("vendor", "placed_by")
            .prefetch_related(Prefetch("items", queryset=OrderItem.objects.select_related("product")))
            .select_related("invoice")
        )
        if user.is_super_admin:
            return qs
        if user.is_warehouse_manager:
            return qs.filter(items__product__organization_id=user.organization_id).distinct()
        return qs.filter(vendor_id=user.organization_id)

    @action(detail=True, methods=["patch"], url_path="status")
    def update_status(self, request, pk=None):
        order = self.get_object()
        serializer = OrderStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]
        user = request.user

        if not user.is_super_admin and not user.is_warehouse_manager:
            allowed = new_status == Order.Status.CANCELLED and order.status == Order.Status.PENDING
            if not allowed or order.vendor_id != user.organization_id:
                raise PermissionDenied("Vendors may only cancel their own pending orders.")

        with transaction.atomic():
            locked = Order.objects.select_for_update().select_related("vendor").get(pk=order.pk)
            if not locked.can_transition_to(new_status):
                raise ConflictError(
                    detail=f"Invalid status transition {locked.status} -> {new_status}.",
                    errors=[
                        {
                            "order_id": locked.id,
                            "current_status": locked.status,
                            "requested_status": new_status,
                            "allowed": sorted(Order.TRANSITIONS.get(locked.status, set())),
                            "message": f"An order in {locked.status} cannot move to {new_status}.",
                        }
                    ],
                )

            previous = locked.status
            locked.status = new_status
            locked.save(update_fields=["status", "updated_at"])

            if new_status == Order.Status.CONFIRMED and previous == Order.Status.PENDING:
                from apps.invoices.services import ensure_invoice

                invoice = ensure_invoice(locked)
                transaction.on_commit(lambda: _enqueue_invoice_workflow(invoice.pk, locked.pk))

            if new_status == Order.Status.CANCELLED:
                _restock_cancelled_order(locked, user)

        order.refresh_from_db()
        return Response(OrderSerializer(order).data, status=http_status.HTTP_200_OK)


def _enqueue_invoice_workflow(invoice_id: int, order_id: int) -> None:
    from apps.invoices.tasks import generate_invoice_pdf, send_invoice_email

    generate_invoice_pdf.delay(invoice_id)
    send_invoice_email.delay(invoice_id)


def _restock_cancelled_order(order: Order, user) -> None:
    from apps.invoices.models import Invoice

    invoice = Invoice.objects.filter(order=order).first()
    if invoice and invoice.status in (Invoice.Status.PAID, Invoice.Status.PAYMENT_SUBMITTED):
        raise ConflictError(
            detail="Order cannot be cancelled after payment has been submitted.",
            errors=[
                {
                    "order_id": order.id,
                    "invoice_id": invoice.id,
                    "invoice_status": invoice.status,
                    "message": "Resolve the payment first.",
                }
            ],
        )

    items = list(order.items.select_related("product").order_by("product_id"))
    product_ids = [item.product_id for item in items]
    products = {
        p.id: p for p in Product.objects.select_for_update().filter(id__in=product_ids).order_by("id")
    }

    for item in items:
        product = products[item.product_id]
        product.stock_qty += item.quantity
        product.save(update_fields=["stock_qty", "updated_at"])
        StockLog.objects.create(
            product=product,
            change_qty=item.quantity,
            quantity_after=product.stock_qty,
            reason=StockLog.Reason.ORDER_CANCELLED,
            note=f"Order {order.order_number} cancelled",
            user=user,
        )

    if invoice:
        invoice.status = Invoice.Status.VOID
        invoice.save(update_fields=["status"])
