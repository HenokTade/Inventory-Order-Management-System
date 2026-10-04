from django.db import connection
from django.http import JsonResponse
from django.urls import path

from apps.core.views import run_cron


def health_check(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            cursor.fetchone()
        database = "up"
    except Exception:
        database = "down"

    status_code = 200 if database == "up" else 503
    return JsonResponse({"status": "ok" if database == "up" else "degraded", "database": database}, status=status_code)


urlpatterns = [
    path("health/", health_check, name="health-check"),
    path("cron/run/", run_cron, name="cron-run"),
]
