from rest_framework.permissions import SAFE_METHODS, BasePermission

from apps.accounts.models import User


class IsSuperAdmin(BasePermission):
    message = "Super Admin role required."

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and request.user.is_super_admin)


class IsWarehouseManager(BasePermission):
    message = "Warehouse Manager role required."

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and request.user.is_warehouse_manager)


class IsVendor(BasePermission):
    message = "Vendor role required."

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated and request.user.is_vendor)


class IsWarehouseManagerOrSuperAdmin(BasePermission):
    message = "Warehouse Manager or Super Admin role required."

    def has_permission(self, request, view) -> bool:
        user = request.user
        return bool(user and user.is_authenticated and (user.is_warehouse_manager or user.is_super_admin))


class IsSuperAdminOrReadOnly(BasePermission):
    message = "Only Super Admins may perform this action."

    def has_permission(self, request, view) -> bool:
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return bool(request.user and request.user.is_authenticated and request.user.is_super_admin)


def role_of(user: User) -> str | None:
    return user.role if user and user.is_authenticated else None
