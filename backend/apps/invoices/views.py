from django.http import FileResponse
from django.utils import timezone
from rest_framework import mixins, status as http_status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.accounts.permissions import IsVendor, IsWarehouseManagerOrSuperAdmin
from apps.core.exceptions import ConflictError
from apps.invoices.models import Invoice
from apps.invoices.serializers import InvoiceSerializer, InvoiceStatusSerializer, PaymentSubmitSerializer
from apps.invoices.tasks import generate_invoice_pdf


class InvoiceViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    serializer_class = InvoiceSerializer
    filterset_fields = ["status"]
    ordering_fields = ["created_at", "due_date", "total_amount"]
    ordering = ["-created_at"]
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        qs = Invoice.objects.select_related("order", "order__vendor", "order__placed_by")
        if user.is_super_admin:
            return qs
        if user.is_warehouse_manager:
            return qs.filter(order__items__product__organization_id=user.organization_id).distinct()
        return qs.filter(order__vendor_id=user.organization_id)

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        invoice = self.get_object()
        if not invoice.pdf_file:
            generate_invoice_pdf.delay(invoice.pk)
            invoice.refresh_from_db()
        if invoice.pdf_file:
            invoice.pdf_file.open("rb")
            return FileResponse(
                invoice.pdf_file,
                as_attachment=False,
                filename=f"{invoice.invoice_number}.pdf",
                content_type="application/pdf",
            )
        return Response(
            {"detail": "PDF generation queued. Retry in a moment."},
            status=http_status.HTTP_202_ACCEPTED,
        )

    @action(detail=True, methods=["post"], url_path="pay", permission_classes=[IsVendor])
    def pay(self, request, pk=None):
        invoice = self.get_object()
        if invoice.order.vendor_id != request.user.organization_id:
            raise PermissionDenied("You can only pay invoices issued to your organization.")
        if invoice.status not in (Invoice.Status.UNPAID, Invoice.Status.OVERDUE):
            raise ConflictError(
                detail=f"Invoice is {invoice.get_status_display()} and cannot accept a payment submission.",
                errors=[
                    {
                        "invoice_id": invoice.id,
                        "invoice_status": invoice.status,
                        "message": "Only unpaid or overdue invoices accept payments.",
                    }
                ],
            )
        serializer = PaymentSubmitSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invoice.payment_reference = serializer.validated_data["payment_reference"]
        proof = serializer.validated_data.get("proof_of_payment")
        if proof:
            invoice.proof_of_payment = proof
        invoice.status = Invoice.Status.PAYMENT_SUBMITTED
        invoice.save()
        return Response(InvoiceSerializer(invoice).data, status=http_status.HTTP_200_OK)

    @action(detail=True, methods=["patch"], url_path="status", permission_classes=[IsWarehouseManagerOrSuperAdmin])
    def verify_status(self, request, pk=None):
        invoice = self.get_object()
        serializer = InvoiceStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_status = serializer.validated_data["status"]

        if new_status == Invoice.Status.PAID and invoice.status == Invoice.Status.VOID:
            raise ConflictError(detail="A voided invoice cannot be marked paid.")
        if invoice.status == Invoice.Status.PAID and new_status != Invoice.Status.PAID:
            raise ConflictError(detail="A paid invoice cannot be reverted.")

        invoice.status = new_status
        if new_status == Invoice.Status.PAID and not invoice.paid_at:
            invoice.paid_at = timezone.now()
        invoice.save()
        return Response(InvoiceSerializer(invoice).data, status=http_status.HTTP_200_OK)
