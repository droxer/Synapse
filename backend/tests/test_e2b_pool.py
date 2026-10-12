"""Executed E2B VMs must never be reassigned to a new conversation."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from agent.sandbox.base import SandboxConfig
from agent.sandbox.e2b_pool import SandboxPool


@pytest.mark.asyncio
async def test_released_vm_is_destroyed_and_cannot_be_acquired():
    pool = SandboxPool("test-key")
    session = SimpleNamespace(kill=AsyncMock(), close=AsyncMock())
    await pool.release(session)
    session.kill.assert_awaited_once()
    session.close.assert_not_awaited()
    assert await pool.acquire(SandboxConfig(template="default")) is None
    await pool.drain()


@pytest.mark.asyncio
async def test_other_session_types_are_closed():
    pool = SandboxPool("test-key")
    session = SimpleNamespace(close=AsyncMock())
    await pool.release(session)
    session.close.assert_awaited_once()
