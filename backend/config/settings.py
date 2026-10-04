import os
from datetime import timedelta
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent

load_dotenv(BASE_DIR / ".env", override=False)
load_dotenv(BASE_DIR.parent / ".env", override=False)
load_dotenv(BASE_DIR / ".env.local", override=False)
load_dotenv(BASE_DIR.parent / ".env.local", override=False)

# Set by the Vercel platform for every build and invocation.
IS_VERCEL = bool(os.environ.get("VERCEL"))


def env_bool(name: str, default: str = "False") -> bool:
    return os.environ.get(name, default).strip().lower() in ("1", "true", "yes", "on")


SECRET_KEY = os.environ.get("SECRET_KEY", "insecure-dev-secret-key-change-me")
DEBUG = env_bool("DEBUG", "False" if IS_VERCEL else "True")
ALLOWED_HOSTS = [h.strip() for h in os.environ.get("ALLOWED_HOSTS", "*").split(",") if h.strip()]
CSRF_TRUSTED_ORIGINS = [o.strip() for o in os.environ.get("CSRF_TRUSTED_ORIGINS", "").split(",") if o.strip()]

# TLS is terminated by the platform proxy (Vercel, nginx), not by Django.
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # Third-party
    "rest_framework",
    "django_filters",
    "corsheaders",
    # Local apps
    "apps.core",
    "apps.accounts",
    "apps.inventory",
    "apps.orders",
    "apps.invoices",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

def database_config() -> dict:
    """Prefer DATABASE_URL / POSTGRES_URL (Vercel integrations) over discrete vars (Docker)."""
    url = next((os.environ.get(key) for key in ("DATABASE_URL", "POSTGRES_URL") if os.environ.get(key)), None)
    if not url:
        return {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ.get("POSTGRES_DB", "inventory_db"),
            "USER": os.environ.get("POSTGRES_USER", "postgres"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", "postgres"),
            "HOST": os.environ.get("POSTGRES_HOST", "db"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
            "CONN_MAX_AGE": int(os.environ.get("CONN_MAX_AGE", "60")),
            "OPTIONS": {"connect_timeout": 10},
        }

    parsed = urlparse(url if "://" in url else f"postgresql://{url}")
    options = {"connect_timeout": 10}
    query = parse_qs(parsed.query)
    if query.get("sslmode"):
        options["sslmode"] = query["sslmode"][0]
    elif parsed.hostname not in (None, "localhost", "127.0.0.1"):
        options["sslmode"] = "require"
    return {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": parsed.path.lstrip("/"),
        "USER": unquote(parsed.username or ""),
        "PASSWORD": unquote(parsed.password or ""),
        "HOST": parsed.hostname or "",
        "PORT": str(parsed.port or 5432),
        "CONN_MAX_AGE": int(os.environ.get("CONN_MAX_AGE", "60")),
        "OPTIONS": options,
    }


DATABASES = {"default": database_config()}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# ---------------------------------------------------------------- File storage
# Serverless filesystems are read-only and ephemeral, so uploaded files
# (invoice PDFs, payment proofs) live in the database when deployed on Vercel.
# FILE_STORAGE=files forces the local filesystem backend (Docker, local dev).
FILE_STORAGE = os.environ.get("FILE_STORAGE", "").strip().lower() or ("db" if IS_VERCEL else "files")
STORAGES = {
    "default": {
        "BACKEND": "apps.core.storage.DatabaseStorage"
        if FILE_STORAGE == "db"
        else "django.core.files.storage.FileSystemStorage"
    },
    "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"},
}

# ---------------------------------------------------------------- CORS
CORS_ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
    if o.strip()
]
CORS_ALLOW_CREDENTIALS = True

# ---------------------------------------------------------------- Cache
# Redis is optional. Docker and local dev provide one; Vercel does not, so
# without REDIS_URL the app falls back to a per-process cache.
REDIS_URL = os.environ.get("REDIS_URL", "").strip() or None
USE_REDIS_CACHE = env_bool("USE_REDIS_CACHE", "True" if REDIS_URL else "False")

if REDIS_URL and USE_REDIS_CACHE:
    CACHES = {
        "default": {
            "BACKEND": "django_redis.cache.RedisCache",
            "LOCATION": REDIS_URL,
            "OPTIONS": {"CLIENT_CLASS": "django_redis.client.DefaultClient"},
            "KEY_PREFIX": "inv",
        }
    }
else:
    CACHES = {
        "default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "inventory-cache"}
    }

# ---------------------------------------------------------------- DRF
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.DefaultPagination",
    "PAGE_SIZE": 10,
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ],
    "EXCEPTION_HANDLER": "apps.core.exceptions.api_exception_handler",
    "DATETIME_FORMAT": "%Y-%m-%dT%H:%M:%S.%fZ",
}

# ---------------------------------------------------------------- SimpleJWT
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=int(os.environ.get("ACCESS_TOKEN_LIFETIME_MINUTES", "30"))),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=int(os.environ.get("REFRESH_TOKEN_LIFETIME_DAYS", "7"))),
    "ROTATE_REFRESH_TOKENS": False,
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ---------------------------------------------------------------- Celery
# Without a broker (Vercel) tasks run inline in the request/invocation that
# queued them, which keeps checkout, PDF generation and email working.
CELERY_BROKER_URL = REDIS_URL
CELERY_RESULT_BACKEND = REDIS_URL
CELERY_TASK_ALWAYS_EAGER = env_bool("CELERY_TASK_ALWAYS_EAGER", "True" if not REDIS_URL else "False")
CELERY_TASK_EAGER_PROPAGATES = True
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_TASK_TRACK_STARTED = True
CELERY_BEAT_SCHEDULE = {
    "invoices.mark_overdue_invoices": {
        "task": "invoices.mark_overdue_invoices",
        "schedule": float(os.environ.get("OVERDUE_SCAN_SECONDS", 60 * 60 * 6)),
    },
    "invoices.daily_analytics_report": {
        "task": "invoices.daily_analytics_report",
        "schedule": float(os.environ.get("ANALYTICS_SCAN_SECONDS", 60 * 60 * 24)),
    },
    "inventory.daily_low_stock_scan": {
        "task": "inventory.daily_low_stock_scan",
        "schedule": float(os.environ.get("LOW_STOCK_SCAN_SECONDS", 60 * 60 * 12)),
    },
}

# ---------------------------------------------------------------- Email
# SMTP is only used when explicitly configured; otherwise mail is printed to
# the console/log so a request never blocks on an unreachable mail server.
EMAIL_BACKEND = os.environ.get("EMAIL_BACKEND") or (
    "django.core.mail.backends.smtp.EmailBackend"
    if not DEBUG and os.environ.get("EMAIL_HOST")
    else "django.core.mail.backends.console.EmailBackend"
)
DEFAULT_FROM_EMAIL = os.environ.get("DEFAULT_FROM_EMAIL", "noreply@inventory.local")

# ---------------------------------------------------------------- Business rules
DEFAULT_PAYMENT_TERMS_DAYS = int(os.environ.get("DEFAULT_PAYMENT_TERMS_DAYS", "30"))
DEFAULT_TAX_RATE = os.environ.get("DEFAULT_TAX_RATE", "0.15")
