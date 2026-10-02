from datetime import timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.conf import settings
from django.utils import timezone

from apps.invoices.models import Invoice
from apps.orders.models import Order


def ensure_invoice(order: Order) -> Invoice:
    """Create the invoice for a confirmed order exactly once (FR-INV-1)."""
    invoice, _created = Invoice.objects.get_or_create(
        order=order,
        defaults=_invoice_defaults(order),
    )
    return invoice


def _invoice_defaults(order: Order) -> dict:
    today = timezone.localdate()
    terms_days = settings.DEFAULT_PAYMENT_TERMS_DAYS
    tax_rate = Decimal(settings.DEFAULT_TAX_RATE)
    subtotal = order.total_amount
    tax_amount = (subtotal * tax_rate).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return {
        "invoice_number": f"INV-{order.pk:06d}",
        "issue_date": today,
        "due_date": today + timedelta(days=terms_days),
        "payment_terms": f"Net {terms_days}",
        "subtotal": subtotal,
        "tax_rate": tax_rate,
        "tax_amount": tax_amount,
        "total_amount": subtotal + tax_amount,
        "status": Invoice.Status.UNPAID,
    }
