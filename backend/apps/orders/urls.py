from django.urls import path
from rest_framework.routers import DefaultRouter

from apps.orders.views import CheckoutView, OrderViewSet

router = DefaultRouter()
router.register("orders", OrderViewSet, basename="order")

urlpatterns = [
    path("orders/checkout/", CheckoutView.as_view(), name="orders-checkout"),
    *router.urls,
]
