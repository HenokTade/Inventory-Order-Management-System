from django.db import transaction
from django.db.models import Count, F, Sum
from django.http import JsonResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsWarehouseManagerOrSuperAdmin
from apps.core.exceptions import ConflictError
from apps.inventory.filters import ProductFilter, StockLogFilter
from apps.inventory.models import Product, RestockOrder, StockLog
from apps.inventory.serializers import (
    ProductSerializer,
    ProductWriteSerializer,
    RestockOrderSerializer,
    StockAdjustSerializer,
    StockLogSerializer,
)


class ProductViewSet(viewsets.ModelViewSet):
    filterset_class = ProductFilter
    search_fields = ["sku_code", "name", "barcode"]
    ordering_fields = ["sku_code", "name", "unit_price", "stock_qty", "created_at"]
    ordering = ["sku_code"]
    http_method_names = ["get", "post", "put", "patch", "delete", "head", "options"]

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy", "adjust_stock", "summary"):
            return [IsWarehouseManagerOrSuperAdmin()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return ProductWriteSerializer
        return ProductSerializer

    def get_queryset(self):
        return (
            Product.objects.visible_to(self.request.user)
            .select_related("organization")
            .prefetch_related("shared_with")
        )

    def perform_create(self, serializer):
        user = self.request.user
        organization = serializer.validated_data.get("organization")
        if not user.is_super_admin:
            if organization and organization != user.organization:
                raise PermissionDenied("You can only create SKUs for your own organization.")
            serializer.save(organization=user.organization)
        else:
            if organization is None:
                raise PermissionDenied({"organization": "A distributor organization is required."})
            serializer.save()

    def perform_update(self, serializer):
        user = self.request.user
        if not user.is_super_admin and serializer.instance.organization_id != user.organization_id:
            raise PermissionDenied("You can only modify SKUs owned by your organization.")
        serializer.save()

    def perform_destroy(self, instance):
        # Soft delete: hard deletion is protected while references exist.
        instance.is_active = False
        instance.save(update_fields=["is_active", "updated_at"])

    @action(detail=True, methods=["patch"], url_path="stock")
    def adjust_stock(self, request, pk=None):
        product = self.get_object()
        serializer = StockAdjustSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        with transaction.atomic():
            locked = Product.objects.select_for_update().get(pk=product.pk)
            current = locked.stock_qty
            if "new_quantity" in data:
                change_qty = int(data["new_quantity"]) - current
            else:
                change_qty = int(data["change_qty"])
            new_stock = current + change_qty
            if new_stock < 0:
                raise ConflictError(
                    detail="Stock adjustment would make stock negative.",
                    errors=[
                        {
                            "product_id": locked.id,
                            "sku_code": locked.sku_code,
                            "requested": abs(change_qty),
                            "available": current,
                            "message": f"Only {current} units available for {locked.sku_code}.",
                        }
                    ],
                )
            locked.stock_qty = new_stock
            locked.save(update_fields=["stock_qty", "updated_at"])
            StockLog.objects.create(
                product=locked,
                change_qty=change_qty,
                quantity_after=new_stock,
                reason=data["reason"],
                note=data.get("note", ""),
                user=request.user,
            )
            if locked.is_low_stock:
                product_id = locked.pk
                transaction.on_commit(lambda: _enqueue_low_stock(product_id))

        return Response(ProductSerializer(locked).data, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        qs = Product.objects.visible_to(request.user)
        agg = qs.aggregate(
            total_skus=Count("id"),
            total_units=Sum("stock_qty"),
        )
        low = qs.filter(stock_qty__lt=F("safety_stock")).count()
        out_of_stock = qs.filter(stock_qty=0).count()
        stock_value = sum(p.unit_price * p.stock_qty for p in qs.only("unit_price", "stock_qty"))
        return JsonResponse(
            {
                "total_skus": agg["total_skus"] or 0,
                "total_units": agg["total_units"] or 0,
                "low_stock_count": low,
                "out_of_stock_count": out_of_stock,
                "stock_value": str(stock_value),
            }
        )


def _enqueue_low_stock(product_id: int) -> None:
    from apps.inventory.tasks import low_stock_workflow

    low_stock_workflow.delay(product_id)


class StockLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = StockLogSerializer
    filterset_class = StockLogFilter
    search_fields = ["product__sku_code", "product__name", "note"]
    ordering_fields = ["created_at"]
    ordering = ["-created_at"]
    permission_classes = [IsWarehouseManagerOrSuperAdmin]

    def get_queryset(self):
        user = self.request.user
        qs = StockLog.objects.select_related("product", "user")
        if user.is_super_admin:
            return qs
        return qs.filter(product__organization_id=user.organization_id)


class RestockOrderViewSet(viewsets.ModelViewSet):
    serializer_class = RestockOrderSerializer
    permission_classes = [IsWarehouseManagerOrSuperAdmin]
    filterset_fields = ["status", "product"]
    search_fields = ["product__sku_code", "product__name"]
    ordering_fields = ["created_at", "updated_at"]
    ordering = ["-created_at"]
    http_method_names = ["get", "patch", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = RestockOrder.objects.select_related("product", "product__organization")
        if user.is_super_admin:
            return qs
        return qs.filter(product__organization_id=user.organization_id)

    def perform_update(self, serializer):
        if serializer.instance.status == RestockOrder.Status.RECEIVED:
            raise ConflictError(detail="A received restock order cannot be modified.")
        restock = serializer.save()
        if restock.status == RestockOrder.Status.RECEIVED:
            _receive_restock(restock)


def _receive_restock(restock: RestockOrder) -> None:
    with transaction.atomic():
        product = Product.objects.select_for_update().get(pk=restock.product_id)
        product.stock_qty += restock.quantity
        product.save(update_fields=["stock_qty", "updated_at"])
        StockLog.objects.create(
            product=product,
            change_qty=restock.quantity,
            quantity_after=product.stock_qty,
            reason=StockLog.Reason.RESTOCK_RECEIVED,
            note=f"Restock order #{restock.pk}",
            user=None,
        )
