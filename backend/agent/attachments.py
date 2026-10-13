"""Attachment types shared by the agent runtimes and their hosts."""

from dataclasses import dataclass

VISION_MIME_TYPES = frozenset(
    {
        "image/png",
        "image/jpeg",
        "image/gif",
        "image/webp",
        "application/pdf",
    }
)


@dataclass(frozen=True)
class FileAttachment:
    """Immutable representation of an uploaded file."""

    filename: str
    content_type: str
    data: bytes
    size: int
    local_path: str | None = None


def serialize_attachment_metadata(
    attachments: tuple[FileAttachment, ...],
) -> list[dict[str, str | int]]:
    """Return stable metadata for attachment events and persisted messages."""
    return [
        {
            "name": attachment.filename,
            "size": attachment.size,
            "type": attachment.content_type,
        }
        for attachment in attachments
    ]
