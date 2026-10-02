from rest_framework import serializers

from apps.orders.models import Order, OrderItem
from apps.orders.services import checkout


class CheckoutItemSerializer(serializers.Serializer):
    product_id = serializers.IntegerField(min_value=1)
    quantity = serializers.IntegerField(min_value=1)


class CheckoutSerializer(serializers.Serializer):
    items = CheckoutItemSerializer(many=True, allow_empty=False)
    shipping_address = serializers.CharField(required=False, allow_blank=True, max_length=255)
    notes = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate_items(self, items):
        merged: dict[int, int] = {}
        for item in items:
            pid = item["product_id"]
            merged[pid] = merged.get(pid, 0) + item["quantity"]
        return [{"product_id": pid, "quantity": qty} for pid, qty in merged.items()]

    def create(self, validated_data):
        request = self.context["request"]
        return checkout(
            user=request.user,
            items=validated_data["items"],
            shipping_address=validated_data.get("shipping_address", ""),
            notes=validated_data.get("notes", ""),
        )


class OrderItemSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku_code", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    line_total = serializers.FloatField(read_only=True)

    class Meta:
        model = OrderItem
        fields = ["id", "product", "product_sku", "product_name", "quantity", "price_at_purchase", "line_total"]


class OrderSerializer(serializers.ModelSerializer):
    items = OrderItemSerializer(many=True, read_only=True)
    vendor_name = serializers.CharField(source="vendor.name", read_only=True)
    placed_by_email = serializers.EmailField(source="placed_by.email", read_only=True, default=None)
    invoice_id = serializers.SerializerMethodField()
    allowed_transitions = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = [
            "id",
            "order_number",
            "vendor",
            "vendor_name",
            "placed_by",
            "placed_by_email",
            "status",
            "total_amount",
            "item_count",
            "shipping_address",
            "notes",
            "items",
            "invoice_id",
            "allowed_transitions",
            "created_at",
            "updated_at",
        ]

    def get_invoice_id(self, obj) -> int | None:
        invoice = getattr(obj, "invoice", None)
        return invoice.id if invoice else None

    def get_allowed_transitions(self, obj) -> list[str]:
        return sorted(Order.TRANSITIONS.get(obj.status, set()))


class OrderStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=Order.Status.choices)
