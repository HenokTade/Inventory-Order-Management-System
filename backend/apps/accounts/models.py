from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class Organization(models.Model):
    class Type(models.TextChoices):
        DISTRIBUTOR = "DISTRIBUTOR", "Distributor"
        VENDOR = "VENDOR", "Vendor"

    name = models.CharField(max_length=255, unique=True)
    type = models.CharField(max_length=20, choices=Type.choices)
    contact_email = models.EmailField(blank=True, default="")
    contact_phone = models.CharField(max_length=32, blank=True, default="")
    address = models.CharField(max_length=255, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["name"]
        indexes = [models.Index(fields=["type"])]

    def __str__(self) -> str:
        return f"{self.name} ({self.type})"


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email, password, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address.")
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", User.Role.SUPER_ADMIN)
        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")
        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    class Role(models.TextChoices):
        SUPER_ADMIN = "SUPER_ADMIN", "Super Admin"
        WAREHOUSE_MANAGER = "WAREHOUSE_MANAGER", "Warehouse Manager"
        VENDOR = "VENDOR", "Vendor"

    username = None
    email = models.EmailField("email address", unique=True)
    role = models.CharField(max_length=30, choices=Role.choices, default=Role.VENDOR, db_index=True)
    organization = models.ForeignKey(
        Organization,
        on_delete=models.PROTECT,
        related_name="users",
        null=True,
        blank=True,
        help_text="Omitted for Super Admins (platform scope).",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    class Meta:
        ordering = ["email"]
        indexes = [models.Index(fields=["role"]), models.Index(fields=["organization"])]

    def __str__(self) -> str:
        return self.email

    @property
    def is_super_admin(self) -> bool:
        return self.role == self.Role.SUPER_ADMIN

    @property
    def is_warehouse_manager(self) -> bool:
        return self.role == self.Role.WAREHOUSE_MANAGER

    @property
    def is_vendor(self) -> bool:
        return self.role == self.Role.VENDOR

    @property
    def organization_type(self) -> str | None:
        return self.organization.type if self.organization_id else None

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.role != self.Role.SUPER_ADMIN and self.organization_id is None:
            raise ValidationError({"organization": "Non-super-admin users must belong to an organization."})
