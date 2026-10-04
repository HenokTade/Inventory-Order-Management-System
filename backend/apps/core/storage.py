from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.deconstruct import deconstructible

from apps.core.models import StoredFile


@deconstructible
class DatabaseStorage(Storage):
    """File storage backed by the StoredFile table (Vercel-friendly)."""

    def _open(self, name, mode="rb"):
        if any(flag in mode for flag in "wa+"):
            raise ValueError("DatabaseStorage only supports read mode; use save() to write.")
        try:
            row = StoredFile.objects.get(name=name)
        except StoredFile.DoesNotExist:
            raise FileNotFoundError(name)
        return ContentFile(bytes(row.content or b""), name=name)

    def _save(self, name, content):
        data = content.read()
        if isinstance(data, str):
            data = data.encode()
        StoredFile.objects.update_or_create(name=name, defaults={"content": data, "size": len(data)})
        return name

    def exists(self, name):
        return StoredFile.objects.filter(name=name).exists()

    def size(self, name):
        try:
            return StoredFile.objects.get(name=name).size
        except StoredFile.DoesNotExist:
            raise OSError(name)

    def url(self, name):
        return f"{settings.MEDIA_URL}{name}"

    def delete(self, name):
        StoredFile.objects.filter(name=name).delete()

    def path(self, name):
        raise NotImplementedError("DatabaseStorage does not map to a filesystem path.")

    def listdir(self, path):
        raise NotImplementedError("DatabaseStorage does not support listdir.")
