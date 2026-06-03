"""Discord Gateway runtime for DM-based channel integration."""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Awaitable, Callable

import discord
from loguru import logger
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from api.channels.provider import DiscordProvider
from api.channels.repository import ChannelRepository
from api.channels.schemas import DiscordBotConfigRecord, InboundMessage

DiscordMessageHandler = Callable[
    [DiscordProvider, InboundMessage, uuid.UUID], Awaitable[None]
]


class DiscordChannelClient(discord.Client):
    """discord.py client that forwards DMs into the channel router."""

    def __init__(
        self,
        *,
        provider: DiscordProvider,
        config_id: uuid.UUID,
        handle_message: DiscordMessageHandler,
    ) -> None:
        intents = discord.Intents.default()
        intents.dm_messages = True
        intents.message_content = True
        super().__init__(intents=intents)
        self._provider = provider
        self._config_id = config_id
        self._handle_message = handle_message

    async def on_ready(self) -> None:
        logger.info(
            "discord_channel_client_ready config_id={} user={}",
            self._config_id,
            self.user,
        )

    async def on_message(self, message: discord.Message) -> None:
        inbound = await self._provider.parse_inbound(message)
        if inbound is None:
            return
        await self._handle_message(self._provider, inbound, self._config_id)


class DiscordClientManager:
    """Owns long-running Discord clients for enabled per-user bot configs."""

    def __init__(
        self,
        *,
        repo: ChannelRepository,
        session_factory: async_sessionmaker[AsyncSession],
        handle_message: DiscordMessageHandler,
    ) -> None:
        self._repo = repo
        self._session_factory = session_factory
        self._handle_message = handle_message
        self._clients: dict[uuid.UUID, DiscordChannelClient] = {}
        self._tasks: dict[uuid.UUID, asyncio.Task[None]] = {}

    async def start_all_enabled(self) -> None:
        async with self._session_factory() as session:
            configs = await self._repo.list_enabled_discord_bot_configs(session)
        for config in configs:
            await self.start_or_restart(config)

    async def start_or_restart(self, config: DiscordBotConfigRecord) -> None:
        await self.stop(config.id)

        provider = DiscordProvider(config.bot_token)
        client = DiscordChannelClient(
            provider=provider,
            config_id=config.id,
            handle_message=self._handle_message,
        )
        provider._client = client  # noqa: SLF001
        self._clients[config.id] = client
        self._tasks[config.id] = asyncio.create_task(
            self._run_client(config, client),
            name=f"discord-channel-{config.id}",
        )

    async def stop(self, config_id: uuid.UUID) -> None:
        client = self._clients.pop(config_id, None)
        task = self._tasks.pop(config_id, None)
        if client is not None:
            await client.close()
            await client._provider.close()  # noqa: SLF001
        if task is not None:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    async def stop_all(self) -> None:
        for config_id in list(self._clients):
            await self.stop(config_id)

    async def _run_client(
        self, config: DiscordBotConfigRecord, client: DiscordChannelClient
    ) -> None:
        try:
            async with client:
                await client.start(config.bot_token)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            logger.warning(
                "discord_channel_client_failed config_id={} error={}",
                config.id,
                exc,
            )
            async with self._session_factory() as session:
                await self._repo.update_discord_bot_config_status(
                    session,
                    config.id,
                    status="error",
                    last_error=str(exc) or exc.__class__.__name__,
                    enabled=True,
                )
