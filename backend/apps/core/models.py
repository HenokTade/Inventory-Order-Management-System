from django.db import models


class StoredFile(models.Model):
    """Uploaded/generated file bytes held in the database.

    Serverless filesystems are read-only and ephemeral, so invoice PDFs and
    payment proofs must not live on local disk when deployed on Vercel.
    """

    name = models.CharField(max_length=255, unique=True, db_index=True)
    content = models.BinaryField()
    size = models.PositiveBigIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
