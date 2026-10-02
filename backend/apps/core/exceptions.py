from django.core.exceptions import PermissionDenied as DjangoPermissionDenied
from django.http import Http404
from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler as drf_exception_handler


def api_exception_handler(exc, context):
    """Return a consistent, structured error payload for the frontend."""
    if isinstance(exc, exceptions.APIException):
        handler = {
            exceptions.ValidationError: status.HTTP_400_BAD_REQUEST,
            exceptions.AuthenticationFailed: status.HTTP_401_UNAUTHORIZED,
            exceptions.NotAuthenticated: status.HTTP_401_UNAUTHORIZED,
            exceptions.PermissionDenied: status.HTTP_403_FORBIDDEN,
            exceptions.NotFound: status.HTTP_404_NOT_FOUND,
            exceptions.MethodNotAllowed: status.HTTP_405_METHOD_NOT_ALLOWED,
            exceptions.NotAcceptable: status.HTTP_406_NOT_ACCEPTABLE,
            exceptions.Throttled: status.HTTP_429_TOO_MANY_REQUESTS,
        }
        status_code = handler.get(type(exc), getattr(exc, "status_code", status.HTTP_400_BAD_REQUEST))
        detail = exc.detail
        errors = getattr(exc, "errors", None)
        if not errors:
            if isinstance(detail, (list, tuple)):
                errors = [{"field": "detail", "message": d} for d in detail]
            elif isinstance(detail, dict):
                errors = [{"field": k, "message": v} for k, v in detail.items()]
            else:
                errors = [{"field": "detail", "message": detail}]
        return Response(
            {"error": {"code": exc.default_code, "message": str(exc.default_detail), "errors": errors}},
            status=status_code,
        )

    if isinstance(exc, Http404):
        return Response(
            {"error": {"code": "not_found", "message": "Not found.", "errors": []}},
            status=status.HTTP_404_NOT_FOUND,
        )

    if isinstance(exc, DjangoPermissionDenied):
        return Response(
            {"error": {"code": "permission_denied", "message": str(exc), "errors": []}},
            status=status.HTTP_403_FORBIDDEN,
        )

    response = drf_exception_handler(exc, context)
    if response is None:
        return None

    message = "A server error occurred."
    if isinstance(response.data, dict):
        message = str(response.data.get("detail", message))
    return Response(
        {"error": {"code": "server_error", "message": message, "errors": []}},
        status=response.status_code,
    )


class ConflictError(exceptions.APIException):
    status_code = status.HTTP_409_CONFLICT
    default_code = "conflict"
    default_detail = "The request conflicts with the current state of the resource."

    def __init__(self, detail=None, code=None, errors=None):
        super().__init__(detail=detail, code=code)
        self.errors = errors or []
