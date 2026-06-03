"""Channel provider protocol and Telegram implementation."""

from __future__ import annotations

import hashlib
import hmac
import io
import mimetypes
from typing import Any, Protocol, runtime_checkable

import discord
import httpx
from loguru import logger

from api.channels.schemas import InboundMessage

TELEGRAM_MAX_MESSAGE_LENGTH = 4096
DISCORD_MAX_MESSAGE_LENGTH = 2000


# ---------------------------------------------------------------------------
# Protocol
# ---------------------------------------------------------------------------


@runtime_checkable
class ChannelProvider(Protocol):
    """Interface that every channel provider must satisfy."""

    @property
    def provider_name(self) -> str: ...

    async def verify_webhook(self, request_body: bytes, signature: str) -> bool: ...

    async def parse_inbound(self, payload: dict) -> InboundMessage | None: ...

    async def send_text(
        self, chat_id: str, text: str, reply_to: str | None = None
    ) -> str: ...

    async def send_file(
        self,
        chat_id: str,
        file_data: bytes,
        filename: str,
        caption: str | None = None,
    ) -> str: ...

    async def download_file(self, file_id: str) -> tuple[bytes, str, str]: ...

    async def get_me(self) -> dict[str, str]: ...

    async def set_webhook(self, url: str, secret: str) -> None: ...

    async def delete_webhook(self) -> None: ...


# ---------------------------------------------------------------------------
# Telegram
# ---------------------------------------------------------------------------


class TelegramProvider:
    """Telegram Bot API channel provider."""

    def __init__(self, bot_token: str, webhook_secret: str) -> None:
        self._token = bot_token
        self._webhook_secret = webhook_secret
        self._base_url = f"https://api.telegram.org/bot{bot_token}/"
        self._file_url = f"https://api.telegram.org/file/bot{bot_token}/"
        self._client = httpx.AsyncClient(timeout=30)

    # -- Protocol properties / helpers ------------------------------------

    @property
    def provider_name(self) -> str:
        return "telegram"

    def _hmac_key(self) -> bytes:
        """SHA-256 hash of the bot token, used as HMAC key."""
        return hashlib.sha256(self._token.encode()).digest()

    def _require_ok(self, resp: httpx.Response) -> dict:
        """Raise when Telegram returns an application-level error."""
        payload = resp.json()
        if payload.get("ok") is not True:
            description = payload.get("description") or "Telegram API request failed"
            raise RuntimeError(description)
        return payload

    # -- Webhook verification ---------------------------------------------

    async def verify_webhook(self, request_body: bytes, signature: str) -> bool:
        expected = hmac.new(self._hmac_key(), request_body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(expected, signature)

    # -- Inbound parsing ---------------------------------------------------

    async def parse_inbound(self, payload: dict) -> InboundMessage | None:
        msg = payload.get("message")
        if msg is None:
            logger.debug("Telegram update has no 'message' field, skipping")
            return None

        chat_id = str(msg["chat"]["id"])
        from_user = msg.get("from", {})
        user_id = str(from_user.get("id", ""))
        display_name = from_user.get("first_name")
        message_id = str(msg["message_id"])
        text: str | None = msg.get("text")

        # -- Command detection --
        is_command = False
        command: str | None = None
        command_args: str | None = None
        if text and text.startswith("/"):
            is_command = True
            parts = text.split(maxsplit=1)
            # Strip bot mention suffix (e.g. /start@MyBot)
            command = parts[0][1:].split("@")[0]
            command_args = parts[1] if len(parts) > 1 else None

        # -- Attachment detection --
        file_id: str | None = None
        file_name: str | None = None
        file_mime: str | None = None

        if doc := msg.get("document"):
            file_id = doc["file_id"]
            file_name = doc.get("file_name")
            file_mime = doc.get("mime_type")
        elif photos := msg.get("photo"):
            # Largest photo is the last element in the array
            best = photos[-1]
            file_id = best["file_id"]
            file_name = "photo.jpg"
            file_mime = "image/jpeg"

        # Use caption as text fallback when a document/photo has no text
        if text is None and (msg.get("document") or msg.get("photo")):
            text = msg.get("caption")

        return InboundMessage(
            provider="telegram",
            provider_user_id=user_id,
            provider_chat_id=chat_id,
            provider_message_id=message_id,
            text=text,
            display_name=display_name,
            file_id=file_id,
            file_name=file_name,
            file_mime_type=file_mime,
            is_command=is_command,
            command=command,
            command_args=command_args,
        )

    # -- Sending -----------------------------------------------------------

    async def send_text(
        self, chat_id: str, text: str, reply_to: str | None = None
    ) -> str:
        last_id = ""
        chunks = _split_text(text, TELEGRAM_MAX_MESSAGE_LENGTH)
        for chunk in chunks:
            body: dict = {"chat_id": chat_id, "text": chunk}
            if reply_to is not None:
                body["reply_to_message_id"] = reply_to
                reply_to = None  # only first chunk replies
            resp = await self._client.post(f"{self._base_url}sendMessage", json=body)
            resp.raise_for_status()
            payload = self._require_ok(resp)
            last_id = str(payload["result"]["message_id"])
        return last_id

    async def send_file(
        self,
        chat_id: str,
        file_data: bytes,
        filename: str,
        caption: str | None = None,
    ) -> str:
        data: dict = {"chat_id": chat_id}
        if caption:
            data["caption"] = caption
        files = {"document": (filename, file_data)}
        resp = await self._client.post(
            f"{self._base_url}sendDocument", data=data, files=files
        )
        resp.raise_for_status()
        payload = self._require_ok(resp)
        return str(payload["result"]["message_id"])

    # -- File download -----------------------------------------------------

    async def download_file(self, file_id: str) -> tuple[bytes, str, str]:
        # Step 1: resolve file_id → file_path via getFile
        resp = await self._client.get(
            f"{self._base_url}getFile", params={"file_id": file_id}
        )
        resp.raise_for_status()
        payload = self._require_ok(resp)
        file_path: str = payload["result"]["file_path"]

        # Step 2: download the actual bytes
        dl_resp = await self._client.get(f"{self._file_url}{file_path}")
        dl_resp.raise_for_status()

        filename = file_path.rsplit("/", maxsplit=1)[-1]
        mime_type = mimetypes.guess_type(filename)[0] or "application/octet-stream"
        return dl_resp.content, filename, mime_type

    async def get_me(self) -> dict[str, str]:
        resp = await self._client.get(f"{self._base_url}getMe")
        resp.raise_for_status()
        payload = self._require_ok(resp)["result"]
        return {
            "bot_user_id": str(payload["id"]),
            "bot_username": str(payload["username"]),
        }

    async def set_webhook(self, url: str, secret: str) -> None:
        resp = await self._client.post(
            f"{self._base_url}setWebhook",
            json={"url": url, "secret_token": secret},
        )
        resp.raise_for_status()
        self._require_ok(resp)

    async def delete_webhook(self) -> None:
        resp = await self._client.post(f"{self._base_url}deleteWebhook")
        resp.raise_for_status()
        self._require_ok(resp)


# ---------------------------------------------------------------------------
# Discord
# ---------------------------------------------------------------------------


class DiscordProvider:
    """Discord DM channel provider backed by discord.py."""

    def __init__(self, bot_token: str, client: discord.Client | None = None) -> None:
        self._token = bot_token
        self._client = client
        self._http = httpx.AsyncClient(
            timeout=30,
            headers={"Authorization": f"Bot {bot_token}"},
        )

    @property
    def provider_name(self) -> str:
        return "discord"

    async def verify_webhook(self, request_body: bytes, signature: str) -> bool:
        return False

    async def parse_inbound(self, payload: dict | Any) -> InboundMessage | None:
        message = payload
        author = getattr(message, "author", None)
        if author is None:
            return None
        if bool(getattr(author, "bot", False)):
            return None
        if getattr(message, "guild", None) is not None:
            logger.debug("Discord guild message ignored; only DMs are supported")
            return None

        channel = getattr(message, "channel", None)
        content = getattr(message, "content", None) or None
        display_name = (
            getattr(author, "global_name", None)
            or getattr(author, "display_name", None)
            or getattr(author, "name", None)
        )

        is_command = False
        command: str | None = None
        command_args: str | None = None
        if content and (content.startswith("!") or content.startswith("/")):
            is_command = True
            parts = content.split(maxsplit=1)
            command = parts[0][1:].lower()
            command_args = parts[1] if len(parts) > 1 else None

        file_id: str | None = None
        file_name: str | None = None
        file_mime: str | None = None
        attachments = list(getattr(message, "attachments", []) or [])
        if attachments:
            attachment = attachments[0]
            file_id = str(getattr(attachment, "url", ""))
            file_name = getattr(attachment, "filename", None)
            file_mime = getattr(attachment, "content_type", None)

        return InboundMessage(
            provider="discord",
            provider_user_id=str(getattr(author, "id")),
            provider_chat_id=str(getattr(channel, "id")),
            provider_message_id=str(getattr(message, "id")),
            text=content,
            display_name=display_name,
            file_id=file_id,
            file_name=file_name,
            file_mime_type=file_mime,
            is_command=is_command,
            command=command,
            command_args=command_args,
        )

    async def send_text(
        self, chat_id: str, text: str, reply_to: str | None = None
    ) -> str:
        channel = await self._resolve_channel(chat_id)
        last_id = ""
        for chunk in _split_text(text, DISCORD_MAX_MESSAGE_LENGTH):
            sent = await channel.send(chunk)
            last_id = str(sent.id)
        return last_id

    async def send_file(
        self,
        chat_id: str,
        file_data: bytes,
        filename: str,
        caption: str | None = None,
    ) -> str:
        channel = await self._resolve_channel(chat_id)
        file = discord.File(io.BytesIO(file_data), filename=filename)
        sent = await channel.send(content=caption, file=file)
        return str(sent.id)

    async def download_file(self, file_id: str) -> tuple[bytes, str, str]:
        resp = await self._http.get(file_id)
        resp.raise_for_status()
        filename = file_id.split("?", maxsplit=1)[0].rsplit("/", maxsplit=1)[-1]
        mime_type = (
            resp.headers.get("content-type") or mimetypes.guess_type(filename)[0]
        )
        return (
            resp.content,
            filename or "discord-attachment",
            mime_type or "application/octet-stream",
        )

    async def get_me(self) -> dict[str, str]:
        resp = await self._http.get("https://discord.com/api/v10/users/@me")
        resp.raise_for_status()
        payload = resp.json()
        username = str(payload.get("username") or payload.get("global_name") or "")
        discriminator = str(payload.get("discriminator") or "0")
        if discriminator and discriminator != "0":
            username = f"{username}#{discriminator}"
        return {
            "bot_user_id": str(payload["id"]),
            "bot_username": username,
        }

    async def set_webhook(self, url: str, secret: str) -> None:
        return None

    async def delete_webhook(self) -> None:
        return None

    async def close(self) -> None:
        await self._http.aclose()

    async def _resolve_channel(self, chat_id: str) -> Any:
        if self._client is None:
            raise RuntimeError("Discord client is not attached")
        channel_id = int(chat_id)
        channel = self._client.get_channel(channel_id)
        if channel is None:
            channel = await self._client.fetch_channel(channel_id)
        if channel is None:
            raise RuntimeError(f"Discord channel not found: {chat_id}")
        return channel


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _split_text(text: str, limit: int) -> list[str]:
    """Split *text* into chunks of at most *limit* characters."""
    if len(text) <= limit:
        return [text]
    chunks: list[str] = []
    while text:
        chunks.append(text[:limit])
        text = text[limit:]
    return chunks
