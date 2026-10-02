from django.conf import settings
from django.db import models

from apps.accounts.models import Organization
from apps.inventory.models import Product


class Order(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        CONFIRMED = "CONFIRMED", "Confirmed"
        PROCESSING = "PROCESSING", "Processing"
        DISPATCHED = "DISPATCHED", "Dispatched"
        DELIVERED = "DELIVERED", "Delivered"
        CANCELLED = "CANCELLED", "Cancelled"

    # Sequential workflow (FR-ORD-4)
    TRANSITIONS: dict[str, set[str]] = {
        Status.PENDING: {Status.CONFIRMED, Status.CANCELLED},
        Status.CONFIRMED: {Status.PROCESSING, Status.CANCELLED},
        Status.PROCESSING: {Status.DISPATCHED, Status.CANCELLED},
        Status.DISPATCHED: {Status.DELIVERED, Status.CANCELLED},
        Status.DELIVERED: set(),
        Status.CANCELLED: set(),
    }
    TERMINAL = {Status.DELIVERED, Status.CANCELLED}

    order_number = models.CharField(max_length=32, unique=True, db_index=True, blank=True, default="")
    vendor = models.ForeignKey(Organization, on_delete=models.PROTECT, related_name="orders", db_index=True)
    placed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="orders", null=True, blank=True
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    total_amount = models.DecimalField(max_digits=14, decimal_places=2, default=0)
    item_count = models.PositiveIntegerField(default=0)
    shipping_address = models.CharField(max_length=255, blank=True, default="")
    notes = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["status", "created_at"], name="order_status_created_idx"),
            models.Index(fields=["vendor", "status"], name="order_vendor_status_idx"),
            models.Index(fields=["created_at"], name="order_created_at_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.order_number or self.pk} [{self.status}]"

    def can_transition_to(self, new_status: str) -> bool:
        return new_status in self.TRANSITIONS.get(self.status, set())


class OrderItem(models.Model):
    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="items")
    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="order_items")
    quantity = models.PositiveIntegerField()
    price_at_purchase = models.DecimalField(max_digits=12, decimal_places=2)

    class Meta:
        ordering = ["id"]
        indexes = [models.Index(fields=["order"], name="orderitem_order_idx")]

    def __str__(self) -> str:
        return f"{self.product.sku_code} x{self.quantity}"

    @property
    def line_total(self) -> float:
        return float(self.quantity) * float(self.price_at_purchase)
