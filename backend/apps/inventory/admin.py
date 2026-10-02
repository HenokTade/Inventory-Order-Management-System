from django.contrib import admin

from apps.inventory.models import Product, RestockOrder, StockLog


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("sku_code", "name", "organization", "stock_qty", "safety_stock", "unit_price", "is_active")
    list_filter = ("is_active", "organization")
    search_fields = ("sku_code", "name", "barcode")
    readonly_fields = ("created_at", "updated_at")


@admin.register(StockLog)
class StockLogAdmin(admin.ModelAdmin):
    list_display = ("product", "change_qty", "quantity_after", "reason", "user", "created_at")
    list_filter = ("reason",)
    search_fields = ("product__sku_code",)
    readonly_fields = ("product", "change_qty", "quantity_after", "reason", "note", "user", "created_at")


@admin.register(RestockOrder)
class RestockOrderAdmin(admin.ModelAdmin):
    list_display = ("product", "quantity", "status", "created_at")
    list_filter = ("status",)
    search_fields = ("product__sku_code",)
