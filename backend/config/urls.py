from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from apps.core.views import serve_media

urlpatterns = [
    path("admin/", admin.site.urls),
    path("media/<path:file_path>", serve_media, name="serve-media"),
    path("api/v1/auth/", include("apps.accounts.auth_urls")),
    path("api/v1/", include("apps.accounts.urls")),
    path("api/v1/", include("apps.core.urls")),
    path("api/v1/", include("apps.inventory.urls")),
    path("api/v1/", include("apps.orders.urls")),
    path("api/v1/", include("apps.invoices.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
