"""Populate the database with a presentation-ready demo dataset.

Usage:
    python manage.py seed_data
    python manage.py seed_data --reset   # wipe first (dev only)
"""

from datetime import timedelta
from decimal import Decimal

from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone

from apps.accounts.models import Organization, User
from apps.invoices.models import Invoice
from apps.invoices.services import ensure_invoice
from apps.invoices.tasks import generate_invoice_pdf
from apps.inventory.models import Product, RestockOrder, StockLog
from apps.orders.models import Order, OrderItem
from apps.orders.services import unit_price_for

PASSWORD = "Demo12345!"

PRODUCTS = [
    # sku, name, unit, wholesale, wholesale_min, stock, safety, aisle/rack/shelf/bin
    ("SKU-1001", "Arabica Coffee Beans 1kg", "18.50", "15.90", 10, 240, 40, ("A1", "R1", "S2", "B1")),
    ("SKU-1002", "Basmati Rice 5kg Bag", "12.00", "10.40", 10, 500, 60, ("A1", "R1", "S3", "B2")),
    ("SKU-1003", "Extra Virgin Olive Oil 750ml", "9.75", "8.29", 12, 120, 30, ("A1", "R2", "S1", "B1")),
    ("SKU-1004", "Green Tea Bags x100", "6.40", "5.60", 10, 80, 20, ("A2", "R1", "S1", "B3")),
    ("SKU-1005", "Protein Bars 24-pack", "22.00", "19.25", 6, 45, 15, ("A2", "R1", "S2", "B1")),
    ("SKU-1006", "Paper Towels 6-roll", "4.25", "3.70", 20, 300, 50, ("B1", "R1", "S1", "B4")),
    ("SKU-1007", "Dish Soap 1L", "3.90", "3.35", 20, 90, 25, ("B1", "R1", "S2", "B2")),
    ("SKU-1008", "LED Bulbs 4-pack", "8.00", "6.95", 10, 150, 35, ("B2", "R2", "S1", "B1")),
    ("SKU-1009", "USB-C Cables 2m", "5.50", "4.75", 10, 20, 40, ("C1", "R1", "S1", "B1")),
    ("SKU-1010", "Wireless Mouse", "14.25", "12.40", 5, 0, 10, ("C1", "R1", "S2", "B2")),
    ("SKU-1011", "A5 Notebook", "2.10", "1.80", 50, 400, 80, ("C2", "R1", "S1", "B1")),
    ("SKU-1012", "Mineral Water 24-pack", "5.00", "4.35", 12, 30, 60, ("D1", "R1", "S1", "B1")),
]


class Command(BaseCommand):
    help = "Seed organizations, users, products, orders and invoices for a demo."

    def add_arguments(self, parser):
        parser.add_argument("--reset", action="store_true", help="Delete existing demo data first (dev only).")

    @transaction.atomic
    def handle(self, *args, **options):
        if options["reset"]:
            self._reset()

        self.org_distributor, _ = Organization.objects.get_or_create(
            name="Northwind Distributors",
            defaults={"type": Organization.Type.DISTRIBUTOR, "contact_email": "ops@northwind.local"},
        )
        self.org_vendor1, _ = Organization.objects.get_or_create(
            name="Blue Mart Retail",
            defaults={"type": Organization.Type.VENDOR, "contact_email": "buying@bluemart.local"},
        )
        self.org_vendor2, _ = Organization.objects.get_or_create(
            name="Corner Shop Co",
            defaults={"type": Organization.Type.VENDOR, "contact_email": "orders@cornershop.local"},
        )

        self.super_admin = self._user("admin@demo.local", User.Role.SUPER_ADMIN, None, "Ada", "Admin")
        self.warehouse = self._user(
            "warehouse@demo.local", User.Role.WAREHOUSE_MANAGER, self.org_distributor, "Wendy", "Manager"
        )
        self.vendor1 = self._user(
            "vendor@demo.local", User.Role.VENDOR, self.org_vendor1, "Vera", "Vendor"
        )
        self.vendor2 = self._user(
            "vendor2@demo.local", User.Role.VENDOR, self.org_vendor2, "Carl", "Customer"
        )

        self._products()
        self._orders()

        self.stdout.write(self.style.SUCCESS("\nSeed complete. Sign in with:"))
        self.stdout.write("  Super Admin    admin@demo.local    /  " + PASSWORD)
        self.stdout.write("  Warehouse Mgr  warehouse@demo.local /  " + PASSWORD)
        self.stdout.write("  Vendor         vendor@demo.local    /  " + PASSWORD)
        self.stdout.write("  Vendor 2       vendor2@demo.local   /  " + PASSWORD)

    # ------------------------------------------------------------------
    def _reset(self):
        Invoice.objects.all().delete()
        Order.objects.all().delete()
        RestockOrder.objects.all().delete()
        StockLog.objects.all().delete()
        Product.objects.all().delete()
        User.objects.all().delete()
        Organization.objects.all().delete()
        self.stdout.write("Existing data cleared.")

    def _user(self, email, role, org, first, last) -> User:
        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                "role": role,
                "organization": org,
                "first_name": first,
                "last_name": last,
                "is_active": True,
            },
        )
        if created or not user.check_password(PASSWORD):
            user.set_password(PASSWORD)
            user.save(update_fields=["password"])
        return user

    def _products(self):
        if Product.objects.filter(sku_code__startswith="SKU-10").exists():
            self.stdout.write("Products already seeded.")
            return
        for sku, name, unit, wholesale, ws_min, stock, safety, loc in PRODUCTS:
            product = Product.objects.create(
                sku_code=sku,
                name=name,
                description=f"{name} — warehouse stock for B2B orders.",
                organization=self.org_distributor,
                unit_price=Decimal(unit),
                wholesale_price=Decimal(wholesale),
                wholesale_min_qty=ws_min,
                stock_qty=stock,
                safety_stock=safety,
                aisle=loc[0],
                rack=loc[1],
                shelf=loc[2],
                bin=loc[3],
            )
            StockLog.objects.create(
                product=product,
                change_qty=stock,
                quantity_after=stock,
                reason=StockLog.Reason.STOCK_IN,
                note="Initial intake",
                user=self.warehouse,
            )
        self.stdout.write(f"Seeded {len(PRODUCTS)} products.")

    def _orders(self):
        if Order.objects.exists():
            self.stdout.write("Orders already seeded.")
            return

        specs = [
            # (vendor user, org, status, [(sku, qty)...], extra)
            (self.vendor1, self.org_vendor1, Order.Status.PENDING, [("SKU-1001", 12), ("SKU-1003", 24)], {}),
            (
                self.vendor1,
                self.org_vendor1,
                Order.Status.CONFIRMED,
                [("SKU-1002", 30), ("SKU-1006", 40)],
                {"invoice": Invoice.Status.UNPAID, "days_due": 30},
            ),
            (
                self.vendor2,
                self.org_vendor2,
                Order.Status.DISPATCHED,
                [("SKU-1005", 8), ("SKU-1008", 15)],
                {"invoice": Invoice.Status.PAYMENT_SUBMITTED, "reference": "TXN-77120-99"},
            ),
            (
                self.vendor2,
                self.org_vendor2,
                Order.Status.DELIVERED,
                [("SKU-1004", 20), ("SKU-1011", 100)],
                {"invoice": Invoice.Status.PAID, "reference": "TXN-66031-42"},
            ),
            (self.vendor1, self.org_vendor1, Order.Status.CANCELLED, [("SKU-1007", 25)], {}),
            (
                self.vendor2,
                self.org_vendor2,
                Order.Status.CONFIRMED,
                [("SKU-1012", 60)],
                {"invoice": Invoice.Status.OVERDUE, "days_due": -3},
            ),
        ]

        for user, org, status, lines, extra in specs:
            order = Order.objects.create(
                vendor=org,
                placed_by=user,
                status=status,
                shipping_address="12 Warehouse Way, Distributor City",
                notes="Seeded demo order.",
            )
            order.order_number = f"PO-{order.pk:06d}"
            total = Decimal("0")
            for sku, qty in lines:
                product = Product.objects.get(sku_code=sku)
                price = unit_price_for(product, qty)
                OrderItem.objects.create(order=order, product=product, quantity=qty, price_at_purchase=price)
                total += price * qty
                if status != Order.Status.CANCELLED:
                    product.stock_qty = max(product.stock_qty - qty, 0)
                    product.save(update_fields=["stock_qty", "updated_at"])
                    StockLog.objects.create(
                        product=product,
                        change_qty=-qty,
                        quantity_after=product.stock_qty,
                        reason=StockLog.Reason.ORDER,
                        note=f"Order {order.order_number}",
                        user=user,
                    )
            order.total_amount = total
            order.item_count = len(lines)
            order.save(update_fields=["order_number", "total_amount", "item_count"])

            invoice_status = extra.get("invoice")
            if invoice_status:
                invoice = ensure_invoice(order)
                invoice.status = invoice_status
                if "days_due" in extra:
                    invoice.due_date = timezone.localdate() + timedelta(days=extra["days_due"])
                if "reference" in extra:
                    invoice.payment_reference = extra["reference"]
                if invoice_status == Invoice.Status.PAID:
                    invoice.paid_at = timezone.now() - timedelta(days=2)
                invoice.save()
                generate_invoice_pdf(invoice.pk)

        self.stdout.write(f"Seeded {len(specs)} orders with invoices.")

        for product in Product.objects.all():
            if product.stock_qty < product.safety_stock:
                RestockOrder.objects.get_or_create(
                    product=product,
                    status=RestockOrder.Status.DRAFT,
                    defaults={
                        "quantity": max(product.safety_stock * 2 - product.stock_qty, product.safety_stock),
                        "trigger_stock": product.stock_qty,
                        "threshold": product.safety_stock,
                        "notes": "Auto-queued by low-stock monitor.",
                    },
                )
        self.stdout.write("Queued draft restock orders for low-stock SKUs.")
