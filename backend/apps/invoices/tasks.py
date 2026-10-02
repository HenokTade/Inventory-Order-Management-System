from io import BytesIO

from celery import shared_task
from django.conf import settings
from django.core.mail import EmailMessage
from django.utils import timezone

from apps.invoices.models import Invoice


@shared_task(name="invoices.generate_invoice_pdf")
def generate_invoice_pdf(invoice_id: int) -> str | None:
    """Render the invoice PDF asynchronously (NFR 2.1 background tasks)."""
    from django.core.files.base import ContentFile

    invoice = (
        Invoice.objects.select_related("order", "order__vendor", "order__placed_by")
        .prefetch_related("order__items__product")
        .filter(pk=invoice_id)
        .first()
    )
    if invoice is None:
        return None

    pdf_bytes = _render_pdf(invoice)
    filename = f"{invoice.invoice_number}.pdf"
    invoice.pdf_file.save(filename, ContentFile(pdf_bytes), save=True)
    return invoice.pdf_file.name


def _render_pdf(invoice: Invoice) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    left = 20 * mm
    right = width - 20 * mm

    c.setFont("Helvetica-Bold", 18)
    c.drawString(left, height - 25 * mm, "TAX INVOICE")

    c.setFont("Helvetica", 10)
    c.drawRightString(right, height - 22 * mm, invoice.invoice_number)
    c.drawRightString(right, height - 27 * mm, f"Issued: {invoice.issue_date.isoformat()}")
    c.drawRightString(right, height - 32 * mm, f"Due: {invoice.due_date.isoformat()} ({invoice.payment_terms})")

    order = invoice.order
    y = height - 45 * mm
    c.setFont("Helvetica-Bold", 11)
    c.drawString(left, y, "From:")
    c.drawString(width / 2, y, "Bill To:")
    c.setFont("Helvetica", 10)
    y -= 5 * mm
    distributor = order.vendor
    c.drawString(left, y, "Inventory Management Platform")
    c.drawString(width / 2, y, order.vendor.name)
    y -= 5 * mm
    c.drawString(left, y, "Distributor Warehouse")
    if order.shipping_address:
        c.drawString(width / 2, y, order.shipping_address)
    y -= 5 * mm
    if order.placed_by_id:
        c.drawString(width / 2, y, order.placed_by.email)

    y -= 12 * mm
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.white)
    c.rect(left, y - 2 * mm, right - left, 7 * mm, stroke=0, fill=1)
    c.setFillColor(colors.black)
    c.drawString(left + 2 * mm, y, "SKU")
    c.drawString(left + 45 * mm, y, "Description")
    c.drawRightString(left + 120 * mm, y, "Qty")
    c.drawRightString(left + 145 * mm, y, "Unit Price")
    c.drawRightString(right, y, "Line Total")

    y -= 6 * mm
    c.setFont("Helvetica", 9)
    for item in order.items.all():
        if y < 40 * mm:
            c.showPage()
            y = height - 25 * mm
            c.setFont("Helvetica", 9)
        c.drawString(left + 2 * mm, y, str(item.product.sku_code)[:24])
        c.drawString(left + 45 * mm, y, item.product.name[:34])
        c.drawRightString(left + 120 * mm, y, str(item.quantity))
        c.drawRightString(left + 145 * mm, y, f"{item.price_at_purchase:,.2f}")
        c.drawRightString(right, y, f"{float(item.quantity) * float(item.price_at_purchase):,.2f}")
        y -= 5.5 * mm

    y -= 6 * mm
    c.setFont("Helvetica", 10)
    c.drawRightString(right - 30 * mm, y, "Subtotal:")
    c.drawRightString(right, y, f"{invoice.subtotal:,.2f}")
    y -= 5.5 * mm
    c.drawRightString(right - 30 * mm, y, f"Tax ({invoice.tax_rate * 100:.0f}%):")
    c.drawRightString(right, y, f"{invoice.tax_amount:,.2f}")
    y -= 7 * mm
    c.setFont("Helvetica-Bold", 12)
    c.drawRightString(right - 30 * mm, y, "Total:")
    c.drawRightString(right, y, f"{invoice.total_amount:,.2f}")

    y -= 14 * mm
    c.setFont("Helvetica-Oblique", 9)
    c.drawString(left, y, f"Payment terms: {invoice.payment_terms}. Status: {invoice.get_status_display()}.")
    y -= 5 * mm
    c.drawString(left, y, "Please quote the invoice number as the payment reference.")

    c.setFont("Helvetica", 8)
    c.drawCentredString(width / 2, 12 * mm, "Generated automatically by the Inventory & Order Management System.")
    c.showPage()
    c.save()
    return buffer.getvalue()


@shared_task(name="invoices.send_invoice_email")
def send_invoice_email(invoice_id: int) -> dict:
    invoice = (
        Invoice.objects.select_related("order", "order__vendor", "order__placed_by")
        .filter(pk=invoice_id)
        .first()
    )
    if invoice is None:
        return {"sent": False}

    recipients: list[str] = []
    if invoice.order.placed_by_id:
        recipients.append(invoice.order.placed_by.email)
    if invoice.order.vendor.contact_email:
        recipients.append(invoice.order.vendor.contact_email)
    recipients = list(dict.fromkeys(recipients))
    if not recipients:
        return {"sent": False, "reason": "no recipients"}

    subject = f"Invoice {invoice.invoice_number} for order {invoice.order.order_number}"
    body = (
        f"Invoice {invoice.invoice_number}\n"
        f"Order: {invoice.order.order_number}\n"
        f"Issued: {invoice.issue_date.isoformat()}\n"
        f"Due: {invoice.due_date.isoformat()} ({invoice.payment_terms})\n"
        f"Total: {invoice.total_amount} (incl. tax {invoice.tax_amount})\n\n"
        "Upload your proof of payment via the vendor portal."
    )
    message = EmailMessage(subject, body, settings.DEFAULT_FROM_EMAIL, recipients)
    if invoice.pdf_file:
        try:
            message.attach(invoice.pdf_file.name, invoice.pdf_file.read(), "application/pdf")
            invoice.pdf_file.seek(0)
        except Exception:
            pass
    sent = message.send(fail_silently=True)
    return {"sent": bool(sent), "recipients": recipients}


@shared_task(name="invoices.mark_overdue_invoices")
def mark_overdue_invoices() -> dict:
    today = timezone.localdate()
    updated = Invoice.objects.filter(status=Invoice.Status.UNPAID, due_date__lt=today).update(
        status=Invoice.Status.OVERDUE
    )
    return {"marked_overdue": updated}


@shared_task(name="invoices.daily_analytics_report")
def daily_analytics_report() -> dict:
    from django.db.models import Count, F, Sum

    from apps.inventory.models import Product
    from apps.orders.models import Order

    today = timezone.localdate()
    stats = {
        "date": today.isoformat(),
        "orders_today": Order.objects.filter(created_at__date=today).count(),
        "orders_by_status": dict(
            Order.objects.filter(created_at__date=today).values_list("status").annotate(n=Count("id")).order_by()
        ),
        "revenue_today": str(
            Order.objects.filter(created_at__date=today).exclude(status=Order.Status.CANCELLED).aggregate(
                t=Sum("total_amount")
            )["t"]
            or 0
        ),
        "low_stock_skus": Product.objects.filter(stock_qty__lt=F("safety_stock")).count(),
        "open_invoices": Invoice.objects.filter(
            status__in=[Invoice.Status.UNPAID, Invoice.Status.OVERDUE, Invoice.Status.PAYMENT_SUBMITTED]
        ).count(),
    }
    return stats
