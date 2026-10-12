"""Browser inference stays in the backend; no credential enters the VM."""

from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest

from agent.llm.client import LLMResponse, TokenUsage, ToolCall
from agent.tools.base import ToolResult
from agent.tools.sandbox.browser import BrowserUse


@pytest.mark.asyncio
async def test_browser_agent_keeps_credentials_off_sandbox(monkeypatch):
    session = SimpleNamespace(exec=AsyncMock(), write_file=AsyncMock())
    response = LLMResponse("done", (), "end_turn", TokenUsage(1, 1))
    client = SimpleNamespace(
        create_message=AsyncMock(return_value=response), close=AsyncMock()
    )
    monkeypatch.setattr(
        "agent.tools.sandbox.browser.AnthropicClient",
        lambda **kwargs: client,
        raising=False,
    )
    result = await BrowserUse(anthropic_api_key="private-server-key").execute(
        session, task="Inspect page"
    )
    assert result.success
    session.exec.assert_not_awaited()
    session.write_file.assert_not_awaited()
    client.close.assert_awaited_once()


@pytest.mark.asyncio
async def test_browser_agent_drives_tools_and_pairs_results(monkeypatch):
    calls = [
        LLMResponse(
            "",
            (ToolCall("nav", "browser_navigate", {"url": "https://example.com"}),),
            "tool_use",
            TokenUsage(1, 1),
        ),
        LLMResponse("Found it", (), "end_turn", TokenUsage(1, 1)),
    ]
    client = SimpleNamespace(
        create_message=AsyncMock(side_effect=calls), close=AsyncMock()
    )
    monkeypatch.setattr(
        "agent.tools.sandbox.browser.AnthropicClient",
        lambda **kwargs: client,
        raising=False,
    )
    navigate = AsyncMock(return_value=ToolResult.ok("Page text"))
    monkeypatch.setattr(
        "agent.tools.sandbox.browser_tools.BrowserNavigate.execute", navigate
    )
    result = await BrowserUse(anthropic_api_key="private-server-key").execute(
        object(), task="Find story"
    )
    assert result.success
    assert "Found it" in result.output
    navigate.assert_awaited_once()
    messages = client.create_message.call_args.kwargs["messages"]
    assert messages[-1]["content"][0]["tool_use_id"] == "nav"


@pytest.mark.asyncio
async def test_browser_never_executes_truncated_calls(monkeypatch):
    response = LLMResponse(
        "", (ToolCall("nav", "browser_navigate", {}),), "max_tokens", TokenUsage(1, 1)
    )
    client = SimpleNamespace(
        create_message=AsyncMock(return_value=response), close=AsyncMock()
    )
    monkeypatch.setattr(
        "agent.tools.sandbox.browser.AnthropicClient",
        lambda **kwargs: client,
        raising=False,
    )
    navigate = AsyncMock()
    monkeypatch.setattr(
        "agent.tools.sandbox.browser_tools.BrowserNavigate.execute", navigate
    )
    result = await BrowserUse(anthropic_api_key="private-server-key").execute(
        object(), task="Find story"
    )
    assert not result.success
    navigate.assert_not_awaited()


@pytest.mark.asyncio
async def test_browser_agent_failure_is_logged_with_cause(monkeypatch):
    from loguru import logger

    client = SimpleNamespace(
        create_message=AsyncMock(side_effect=RuntimeError("invalid x-api-key")),
        close=AsyncMock(),
    )
    monkeypatch.setattr(
        "agent.tools.sandbox.browser.AnthropicClient",
        lambda **kwargs: client,
        raising=False,
    )
    records: list[str] = []
    sink_id = logger.add(lambda message: records.append(str(message)), level="ERROR")
    try:
        result = await BrowserUse(anthropic_api_key="key").execute(
            object(), task="Find story"
        )
    finally:
        logger.remove(sink_id)
    assert not result.success
    assert any("invalid x-api-key" in record for record in records)


@pytest.mark.asyncio
@pytest.mark.parametrize("max_steps", [None, "many", True])
async def test_browser_agent_tolerates_invalid_max_steps(monkeypatch, max_steps):
    response = LLMResponse("done", (), "end_turn", TokenUsage(1, 1))
    client = SimpleNamespace(
        create_message=AsyncMock(return_value=response), close=AsyncMock()
    )
    monkeypatch.setattr(
        "agent.tools.sandbox.browser.AnthropicClient",
        lambda **kwargs: client,
        raising=False,
    )
    result = await BrowserUse(anthropic_api_key="key").execute(
        object(), task="Inspect", max_steps=max_steps
    )
    assert result.success
