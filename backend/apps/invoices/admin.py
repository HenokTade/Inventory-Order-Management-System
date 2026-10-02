from django.contrib import admin

from apps.invoices.models import Invoice


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "order", "status", "total_amount", "due_date", "paid_at")
    list_filter = ("status",)
    search_fields = ("invoice_number", "order__order_number", "payment_reference")
    readonly_fields = ("invoice_number", "subtotal", "tax_rate", "tax_amount", "total_amount", "created_at")
