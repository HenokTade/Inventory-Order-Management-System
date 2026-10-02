import pytest

from apps.accounts.models import Organization, User

pytestmark = pytest.mark.django_db


def test_obtain_token_pair_returns_jwt_and_user_payload(api_client, vendor_user):
    resp = api_client.post(
        "/api/v1/auth/token/", {"email": vendor_user.email, "password": "VendorPass123!"}, format="json"
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access" in body and "refresh" in body
    assert body["user"]["email"] == vendor_user.email
    assert body["user"]["role"] == User.Role.VENDOR
    assert body["user"]["organization_name"] == "Beta Retailers"


def test_obtain_token_rejects_bad_credentials(api_client, vendor_user):
    resp = api_client.post(
        "/api/v1/auth/token/", {"email": vendor_user.email, "password": "wrong"}, format="json"
    )
    assert resp.status_code == 401


def test_refresh_token_rotates_access_token(api_client, vendor_user):
    pair = api_client.post(
        "/api/v1/auth/token/", {"email": vendor_user.email, "password": "VendorPass123!"}, format="json"
    ).json()
    resp = api_client.post("/api/v1/auth/token/refresh/", {"refresh": pair["refresh"]}, format="json")
    assert resp.status_code == 200
    assert "access" in resp.json()


def test_me_endpoint_scoped_to_authenticated_user(as_vendor, vendor_user):
    resp = as_vendor.get("/api/v1/auth/me/")
    assert resp.status_code == 200
    assert resp.json()["email"] == vendor_user.email


def test_me_endpoint_requires_authentication(api_client):
    resp = api_client.get("/api/v1/auth/me/")
    assert resp.status_code == 401


def test_vendor_cannot_create_users(as_vendor):
    resp = as_vendor.post(
        "/api/v1/users/",
        {
            "email": "new@example.com",
            "password": "StrongPass123!",
            "role": User.Role.VENDOR,
        },
        format="json",
    )
    assert resp.status_code == 403


def test_super_admin_creates_vendor_user_requires_organization(as_super_admin):
    resp = as_super_admin.post(
        "/api/v1/users/",
        {"email": "noorg@example.com", "password": "StrongPass123!", "role": User.Role.VENDOR},
        format="json",
    )
    assert resp.status_code == 400
    assert "organization" in str(resp.json())


def test_super_admin_creates_vendor_user(as_super_admin, vendor_org):
    resp = as_super_admin.post(
        "/api/v1/users/",
        {
            "email": "newvendor@example.com",
            "password": "StrongPass123!",
            "first_name": "New",
            "last_name": "Vendor",
            "role": User.Role.VENDOR,
            "organization": vendor_org.id,
        },
        format="json",
    )
    assert resp.status_code == 201, resp.json()
    created = User.objects.get(email="newvendor@example.com")
    assert created.check_password("StrongPass123!")
    assert created.organization_id == vendor_org.id


def test_warehouse_user_cannot_be_created_in_vendor_org(as_super_admin, vendor_org):
    resp = as_super_admin.post(
        "/api/v1/users/",
        {
            "email": "mixed@example.com",
            "password": "StrongPass123!",
            "role": User.Role.WAREHOUSE_MANAGER,
            "organization": vendor_org.id,
        },
        format="json",
    )
    assert resp.status_code == 400


def test_organization_onboarding_requires_super_admin(as_warehouse):
    resp = as_warehouse.post(
        "/api/v1/organizations/", {"name": "Rogue Inc", "type": Organization.Type.VENDOR}, format="json"
    )
    assert resp.status_code == 403


def test_super_admin_onboards_organization(as_super_admin):
    resp = as_super_admin.post(
        "/api/v1/organizations/", {"name": "Delta Traders", "type": Organization.Type.VENDOR}, format="json"
    )
    assert resp.status_code == 201
    assert Organization.objects.filter(name="Delta Traders").exists()
