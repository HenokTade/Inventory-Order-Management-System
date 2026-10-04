import mimetypes
import os

from django.conf import settings
from django.core.files.storage import default_storage
from django.http import FileResponse, Http404, JsonResponse
from django.views.decorators.http import require_GET

from apps.core.media import unsign_media_name


@require_GET
def serve_media(request, file_path):
    """Serve database-stored files (invoice PDFs, payment proofs)."""
    if unsign_media_name(request.GET.get("token", "")) != file_path:
        raise Http404("Not found")
    if not default_storage.exists(file_path):
        raise Http404("Not found")

    content_type = mimetypes.guess_type(file_path)[0] or "application/octet-stream"
    return FileResponse(
        default_storage.open(file_path, "rb"),
        as_attachment=False,
        filename=file_path.rsplit("/", 1)[-1],
        content_type=content_type,
    )


@require_GET
def run_cron(request):
    """Daily maintenance run, triggered by the Vercel cron job."""
    secret = os.environ.get("CRON_SECRET", "")
    authorization = request.headers.get("Authorization", "")
    if secret:
        if authorization != f"Bearer {secret}":
            return JsonResponse({"detail": "Unauthorized"}, status=401)
    elif not settings.DEBUG:
        return JsonResponse({"detail": "CRON_SECRET is not configured"}, status=401)

    from apps.inventory.tasks import daily_low_stock_scan
    from apps.invoices.tasks import daily_analytics_report, mark_overdue_invoices

    return JsonResponse(
        {
            "overdue": mark_overdue_invoices(),
            "low_stock": daily_low_stock_scan(),
            "analytics": daily_analytics_report(),
        }
    )
