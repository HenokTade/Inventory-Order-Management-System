from rest_framework.routers import DefaultRouter

from apps.inventory.views import ProductViewSet, RestockOrderViewSet, StockLogViewSet

router = DefaultRouter()
router.register("inventory", ProductViewSet, basename="inventory")
router.register("stock-logs", StockLogViewSet, basename="stocklog")
router.register("restocks", RestockOrderViewSet, basename="restock")

urlpatterns = router.urls
