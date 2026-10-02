from django.urls import include, path
from rest_framework.routers import DefaultRouter

from apps.accounts.views import MeView, OrganizationViewSet, RoleCatalogView, UserViewSet

router = DefaultRouter()
router.register("users", UserViewSet, basename="user")
router.register("organizations", OrganizationViewSet, basename="organization")

urlpatterns = [
    path("auth/me/", MeView.as_view(), name="me"),
    path("catalogs/", RoleCatalogView.as_view(), name="catalogs"),
    path("", include(router.urls)),
]
