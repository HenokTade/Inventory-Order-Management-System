import pytest
from django.db import connections
from rest_framework.test import APIClient

from apps.accounts.models import Organization, User


@pytest.fixture(autouse=True)
def media_tmpdir(tmp_path, settings):
    settings.MEDIA_ROOT = str(tmp_path / "media")
    settings.STORAGES = {
        "default": {"BACKEND": "django.core.files.storage.FileSystemStorage"},
        "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
    }


@pytest.fixture(autouse=True)
def eager_celery(settings):
    """Run Celery tasks inline so async workflows are deterministic in tests."""
    from config.celery import app

    previous_conf = app._conf
    settings.CELERY_TASK_ALWAYS_EAGER = True
    settings.CELERY_TASK_EAGER_PROPAGATES = True
    # Celery snapshots Django settings on first config access, so drop the cache
    # to make the eager overrides above actually take effect.
    app._conf = None
    yield
    app._conf = previous_conf


@pytest.fixture
def api_client() -> APIClient:
    return APIClient()


@pytest.fixture
def distributor(db) -> Organization:
    return Organization.objects.create(name="Acme Distributors", type=Organization.Type.DISTRIBUTOR)


@pytest.fixture
def vendor_org(db) -> Organization:
    return Organization.objects.create(name="Beta Retailers", type=Organization.Type.VENDOR)


@pytest.fixture
def vendor_org_2(db) -> Organization:
    return Organization.objects.create(name="Gamma Stores", type=Organization.Type.VENDOR)


@pytest.fixture
def super_admin(db) -> User:
    return User.objects.create_user(
        email="admin@example.com", password="AdminPass123!", role=User.Role.SUPER_ADMIN
    )


@pytest.fixture
def warehouse_user(db, distributor) -> User:
    return User.objects.create_user(
        email="warehouse@example.com",
        password="WarehousePass123!",
        role=User.Role.WAREHOUSE_MANAGER,
        organization=distributor,
        first_name="Wendy",
        last_name="Manager",
    )


@pytest.fixture
def vendor_user(db, vendor_org) -> User:
    return User.objects.create_user(
        email="vendor@example.com",
        password="VendorPass123!",
        role=User.Role.VENDOR,
        organization=vendor_org,
        first_name="Vera",
        last_name="Vendor",
    )


@pytest.fixture
def vendor_user_2(db, vendor_org_2) -> User:
    return User.objects.create_user(
        email="vendor2@example.com",
        password="VendorPass123!",
        role=User.Role.VENDOR,
        organization=vendor_org_2,
    )


def login(user: User) -> APIClient:
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.fixture
def product(db, distributor):
    from decimal import Decimal

    from apps.inventory.models import Product

    return Product.objects.create(
        sku_code="SKU-001",
        name="Widget",
        organization=distributor,
        unit_price=Decimal("10.00"),
        wholesale_price=Decimal("8.00"),
        wholesale_min_qty=10,
        stock_qty=100,
        safety_stock=10,
        aisle="A",
        rack="1",
        shelf="2",
        bin="3",
    )


@pytest.fixture
def as_vendor(vendor_user):
    return login(vendor_user)


@pytest.fixture
def as_vendor_2(vendor_user_2):
    return login(vendor_user_2)


@pytest.fixture
def as_warehouse(warehouse_user):
    return login(warehouse_user)


@pytest.fixture
def as_super_admin(super_admin):
    return login(super_admin)


def close_thread_connections():
    for conn in connections.all():
        conn.close()
