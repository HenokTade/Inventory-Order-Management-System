from django.conf import settings
from django.db import models

from apps.accounts.models import Organization


class ProductQuerySet(models.QuerySet):
    def visible_to(self, user):
        """Tenant-scoped visibility (FR-AUTH-3)."""
        if user.is_super_admin:
            return self
        if user.is_warehouse_manager:
            return self.filter(organization_id=user.organization_id)
        org_id = user.organization_id
        return (
            self.filter(is_active=True)
            .filter(
                models.Q(organization_id=org_id)
                |                 models.Q(shared_with__isnull=True)
                | models.Q(shared_with__id=org_id)
            )
            .distinct()
        )

    def low_stock(self):
        return self.filter(stock_qty__lt=models.F("safety_stock"))


class Product(models.Model):
    """SKU record owned by a Distributor organization (FR-INV-1, FR-INV-2)."""

    sku_code = models.CharField(max_length=64, unique=True, db_index=True)
    barcode = models.CharField(max_length=64, blank=True, default="", db_index=True)
    name = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True, default="")

    unit_price = models.DecimalField(max_digits=12, decimal_places=2)
    wholesale_price = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    wholesale_min_qty = models.PositiveIntegerField(default=10)

    stock_qty = models.PositiveIntegerField(default=0)
    safety_stock = models.PositiveIntegerField(default=0, help_text="Minimum reorder threshold.")

    organization = models.ForeignKey(
        Organization, on_delete=models.PROTECT, related_name="products", limit_choices_to={"type": "DISTRIBUTOR"}
    )
    shared_with = models.ManyToManyField(
        Organization, blank=True, related_name="shared_products", help_text="Empty = shared with every vendor."
    )

    aisle = models.CharField(max_length=16, blank=True, default="")
    rack = models.CharField(max_length=16, blank=True, default="")
    shelf = models.CharField(max_length=16, blank=True, default="")
    bin = models.CharField(max_length=16, blank=True, default="")

    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    objects = ProductQuerySet.as_manager()

    class Meta:
        ordering = ["sku_code"]
        indexes = [
            models.Index(fields=["sku_code"], name="product_sku_btree_idx"),
            models.Index(fields=["organization", "is_active"], name="product_org_active_idx"),
            models.Index(fields=["created_at"], name="product_created_at_idx"),
        ]
        constraints = [
            models.CheckConstraint(condition=models.Q(stock_qty__gte=0), name="product_stock_non_negative"),
        ]

    def __str__(self) -> str:
        return f"{self.sku_code} - {self.name}"

    @property
    def is_low_stock(self) -> bool:
        return self.stock_qty < self.safety_stock

    @property
    def location(self) -> str:
        return "-".join(p for p in [self.aisle, self.rack, self.shelf, self.bin] if p)


class StockLog(models.Model):
    """Immutable stock movement audit trail (FR-INV-3)."""

    class Reason(models.TextChoices):
        STOCK_IN = "STOCK_IN", "Stock In"
        STOCK_OUT = "STOCK_OUT", "Stock Out"
        DAMAGED = "DAMAGED", "Damaged"
        ADJUSTED = "ADJUSTED", "Adjusted"
        ORDER = "ORDER", "Order deduction"
        ORDER_CANCELLED = "ORDER_CANCELLED", "Order cancellation"
        RESTOCK_RECEIVED = "RESTOCK_RECEIVED", "Restock received"

    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="stock_logs")
    change_qty = models.IntegerField()
    quantity_after = models.PositiveIntegerField()
    reason = models.CharField(max_length=32, choices=Reason.choices, db_index=True)
    note = models.CharField(max_length=255, blank=True, default="")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="stock_logs", null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["product", "created_at"], name="stocklog_product_created_idx"),
            models.Index(fields=["created_at"], name="stocklog_created_at_idx"),
        ]

    def __str__(self) -> str:
        return f"{self.product.sku_code} {self.change_qty:+d} ({self.reason})"


class RestockOrder(models.Model):
    """Draft vendor restocking order queued by the low-stock workflow (FR-INV-3)."""

    class Status(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        SENT = "SENT", "Sent to supplier"
        RECEIVED = "RECEIVED", "Received"
        CANCELLED = "CANCELLED", "Cancelled"

    product = models.ForeignKey(Product, on_delete=models.PROTECT, related_name="restock_orders")
    quantity = models.PositiveIntegerField()
    trigger_stock = models.IntegerField()
    threshold = models.PositiveIntegerField()
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.DRAFT, db_index=True)
    notes = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["status", "created_at"], name="restock_status_created_idx")]

    def __str__(self) -> str:
        return f"Restock {self.product.sku_code} x{self.quantity} [{self.status}]"
