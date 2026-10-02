from django.db import models

from apps.orders.models import Order


class Invoice(models.Model):
    """Digital invoice, 1-to-1 with an order (FR-INV-1, FR-INV-2)."""

    class Status(models.TextChoices):
        UNPAID = "UNPAID", "Unpaid"
        PAYMENT_SUBMITTED = "PAYMENT_SUBMITTED", "Payment submitted"
        PAID = "PAID", "Paid"
        OVERDUE = "OVERDUE", "Overdue"
        VOID = "VOID", "Void"

    order = models.OneToOneField(Order, on_delete=models.PROTECT, related_name="invoice")
    invoice_number = models.CharField(max_length=32, unique=True, db_index=True)
    issue_date = models.DateField()
    due_date = models.DateField(db_index=True)
    payment_terms = models.CharField(max_length=32, default="Net 30")

    subtotal = models.DecimalField(max_digits=14, decimal_places=2)
    tax_rate = models.DecimalField(max_digits=5, decimal_places=4, default=0)
    tax_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2)

    status = models.CharField(max_length=24, choices=Status.choices, default=Status.UNPAID, db_index=True)
    payment_reference = models.CharField(max_length=120, blank=True, default="")
    proof_of_payment = models.FileField(upload_to="proofs/", blank=True, default="")
    pdf_file = models.FileField(upload_to="invoices/", blank=True, default="")
    paid_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"], name="invoice_status_created_idx"),
            models.Index(fields=["created_at"], name="invoice_created_at_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.invoice_number} [{self.status}]"
