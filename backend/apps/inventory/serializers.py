from rest_framework import serializers

from apps.accounts.models import Organization
from apps.inventory.models import Product, RestockOrder, StockLog


class ProductSerializer(serializers.ModelSerializer):
    organization_name = serializers.CharField(source="organization.name", read_only=True)
    location = serializers.CharField(read_only=True)
    is_low_stock = serializers.BooleanField(read_only=True)
    shared_with = serializers.PrimaryKeyRelatedField(
        many=True, queryset=Organization.objects.all(), required=False
    )

    class Meta:
        model = Product
        fields = [
            "id",
            "sku_code",
            "barcode",
            "name",
            "description",
            "unit_price",
            "wholesale_price",
            "wholesale_min_qty",
            "stock_qty",
            "safety_stock",
            "organization",
            "organization_name",
            "shared_with",
            "aisle",
            "rack",
            "shelf",
            "bin",
            "location",
            "is_active",
            "is_low_stock",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "stock_qty", "created_at", "updated_at"]


class ProductWriteSerializer(ProductSerializer):
    class Meta(ProductSerializer.Meta):
        read_only_fields = ["id", "stock_qty", "created_at", "updated_at"]
        extra_kwargs = {"organization": {"required": False}}

    def validate(self, attrs):
        request = self.context.get("request")
        user = request.user if request else None
        if self.instance is None:
            if attrs.get("organization") is None and not (user and user.is_warehouse_manager):
                raise serializers.ValidationError({"organization": "This field is required."})
        organization = attrs.get("organization", getattr(self.instance, "organization", None))
        if organization is not None and organization.type != "DISTRIBUTOR":
            raise serializers.ValidationError(
                {"organization": "SKUs can only be owned by a Distributor organization."}
            )
        wholesale_price = attrs.get("wholesale_price", getattr(self.instance, "wholesale_price", None))
        wholesale_min_qty = attrs.get("wholesale_min_qty", getattr(self.instance, "wholesale_min_qty", 10))
        if wholesale_price is not None and wholesale_min_qty < 2:
            raise serializers.ValidationError(
                {"wholesale_min_qty": "Wholesale pricing requires a minimum quantity of at least 2."}
            )
        return attrs


class StockAdjustSerializer(serializers.Serializer):
    change_qty = serializers.IntegerField(required=False)
    new_quantity = serializers.IntegerField(required=False, min_value=0)
    reason = serializers.ChoiceField(choices=StockLog.Reason.choices)
    note = serializers.CharField(required=False, allow_blank=True, max_length=255)

    def validate(self, attrs):
        if "change_qty" not in attrs and "new_quantity" not in attrs:
            raise serializers.ValidationError("Provide either 'change_qty' or 'new_quantity'.")
        if attrs.get("reason") in (StockLog.Reason.STOCK_IN, StockLog.Reason.RESTOCK_RECEIVED) and attrs.get(
            "change_qty", 0
        ) < 0 and "new_quantity" not in attrs:
            raise serializers.ValidationError({"change_qty": "Stock-in adjustments must be positive."})
        return attrs


class StockLogSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku_code", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)
    user_email = serializers.EmailField(source="user.email", read_only=True, default=None)

    class Meta:
        model = StockLog
        fields = [
            "id",
            "product",
            "product_sku",
            "product_name",
            "change_qty",
            "quantity_after",
            "reason",
            "note",
            "user",
            "user_email",
            "created_at",
        ]


class RestockOrderSerializer(serializers.ModelSerializer):
    product_sku = serializers.CharField(source="product.sku_code", read_only=True)
    product_name = serializers.CharField(source="product.name", read_only=True)

    class Meta:
        model = RestockOrder
        fields = [
            "id",
            "product",
            "product_sku",
            "product_name",
            "quantity",
            "trigger_stock",
            "threshold",
            "status",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "trigger_stock", "threshold", "created_at", "updated_at"]
