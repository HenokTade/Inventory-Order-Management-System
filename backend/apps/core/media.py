from django.conf import settings
from django.core import signing

MEDIA_SIGNING_SALT = "core.media"


def sign_media_url(name: str) -> str | None:
    """Build an expiring-capable, tamper-proof URL for a stored file."""
    if not name:
        return None
    token = signing.dumps(name, salt=MEDIA_SIGNING_SALT)
    return f"{settings.MEDIA_URL}{name}?token={token}"


def unsign_media_name(token: str) -> str | None:
    """Return the file name encoded in a media token, or None if invalid."""
    if not token:
        return None
    try:
        return signing.loads(token, salt=MEDIA_SIGNING_SALT)
    except signing.BadSignature:
        return None
