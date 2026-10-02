from django.db.models import Count
from rest_framework import generics, permissions, status, viewsets
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import Organization, User
from apps.accounts.permissions import IsSuperAdmin
from apps.accounts.serializers import (
    OrganizationSerializer,
    UserCreateSerializer,
    UserSerializer,
)


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserViewSet(viewsets.ModelViewSet):
    """User management. Super Admin manages all; Warehouse Manager views its org."""

    pagination_class = None

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        return UserSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsSuperAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.select_related("organization")
        if user.is_super_admin:
            return qs
        if user.organization_id:
            return qs.filter(organization_id=user.organization_id)
        return qs.filter(pk=user.pk)

    def perform_create(self, serializer):
        serializer.save()


class OrganizationViewSet(viewsets.ModelViewSet):
    pagination_class = None
    queryset = Organization.objects.all()

    def get_serializer_class(self):
        return OrganizationSerializer

    def get_permissions(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return [IsSuperAdmin()]
        return [permissions.IsAuthenticated()]

    def get_queryset(self):
        user = self.request.user
        qs = Organization.objects.all()
        if user.is_super_admin:
            return qs.annotate(user_count=Count("users"))
        if user.organization_id:
            return qs.filter(pk=user.organization_id).annotate(user_count=Count("users"))
        return qs.none()


class RoleCatalogView(APIView):
    """Static catalogs for the frontend (roles, org types, statuses, reasons)."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        from apps.inventory.models import StockLog
        from apps.orders.models import Order

        return Response(
            {
                "roles": [{"value": v, "label": l} for v, l in User.Role.choices],
                "organization_types": [{"value": v, "label": l} for v, l in Organization.Type.choices],
                "order_statuses": [{"value": v, "label": l} for v, l in Order.Status.choices],
                "stock_reasons": [{"value": v, "label": l} for v, l in StockLog.Reason.choices],
            }
        )
