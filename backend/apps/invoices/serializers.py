from rest_framework import serializers

from apps.invoices.models import Invoice


class InvoiceSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="order.order_number", read_only=True)
    vendor_name = serializers.CharField(source="order.vendor.name", read_only=True)
    pdf_url = serializers.FileField(source="pdf_file", read_only=True)
    proof_url = serializers.FileField(source="proof_of_payment", read_only=True)

    class Meta:
        model = Invoice
        fields = [
            "id",
            "invoice_number",
            "order",
            "order_number",
            "vendor_name",
            "issue_date",
            "due_date",
            "payment_terms",
            "subtotal",
            "tax_rate",
            "tax_amount",
            "total_amount",
            "status",
            "payment_reference",
            "proof_of_payment",
            "proof_url",
            "pdf_file",
            "pdf_url",
            "paid_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [f for f in fields if f not in ("payment_reference", "proof_of_payment")]


class PaymentSubmitSerializer(serializers.Serializer):
    payment_reference = serializers.CharField(max_length=120)
    proof_of_payment = serializers.FileField(required=False, allow_null=True)


class InvoiceStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[Invoice.Status.PAID, Invoice.Status.VOID, Invoice.Status.UNPAID])
