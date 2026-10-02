from django.contrib import admin

from apps.orders.models import Order, OrderItem


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    readonly_fields = ("product", "quantity", "price_at_purchase")


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "vendor", "status", "total_amount", "item_count", "created_at")
    list_filter = ("status", "vendor")
    search_fields = ("order_number",)
    inlines = [OrderItemInline]
    readonly_fields = ("order_number", "total_amount", "item_count", "created_at", "updated_at")
