"""Signed extended-thinking blocks must round-trip into assistant history."""

from __future__ import annotations

from types import SimpleNamespace

import pytest

from agent.llm.client import (
    AnthropicClient,
    LLMResponse,
    TokenUsage,
    ToolCall,
    _parse_response,
)
from agent.runtime.helpers import apply_response_to_state
from agent.runtime.orchestrator import AgentState


@pytest.fixture(autouse=True)
def _client_settings(monkeypatch) -> None:
    monkeypatch.setattr(
        "agent.llm.client.get_settings",
        lambda: SimpleNamespace(AGENT_DEBUG_LOGGING=False),
    )


def _response_with_thinking() -> SimpleNamespace:
    return SimpleNamespace(
        content=[
            SimpleNamespace(type="thinking", thinking="reasoning", signature="sig-1"),
            SimpleNamespace(type="redacted_thinking", data="opaque-blob"),
            SimpleNamespace(type="text", text="calling tool"),
            SimpleNamespace(type="tool_use", id="t1", name="shell", input={"c": 1}),
        ],
        stop_reason="tool_use",
        usage=SimpleNamespace(input_tokens=3, output_tokens=4),
    )


def test_parse_response_captures_raw_thinking_blocks() -> None:
    parsed = _parse_response(_response_with_thinking())

    assert parsed.thinking == "reasoning"
    assert parsed.thinking_blocks == (
        {"type": "thinking", "thinking": "reasoning", "signature": "sig-1"},
        {"type": "redacted_thinking", "data": "opaque-blob"},
    )


def test_parse_response_skips_unsigned_thinking_blocks() -> None:
    response = SimpleNamespace(
        content=[
            SimpleNamespace(type="thinking", thinking="no sig"),
            SimpleNamespace(type="text", text="hi"),
        ],
        stop_reason="end_turn",
        usage=SimpleNamespace(input_tokens=1, output_tokens=1),
    )

    parsed = _parse_response(response)

    assert parsed.thinking == "no sig"
    assert parsed.thinking_blocks == ()


def test_llm_response_thinking_blocks_default_empty() -> None:
    r = LLMResponse(
        text="x",
        tool_calls=(),
        stop_reason="end_turn",
        usage=TokenUsage(input_tokens=1, output_tokens=1),
    )
    assert r.thinking_blocks == ()


def test_apply_response_puts_thinking_blocks_first() -> None:
    thinking = {"type": "thinking", "thinking": "r", "signature": "s"}
    redacted = {"type": "redacted_thinking", "data": "d"}
    response = LLMResponse(
        text="calling",
        tool_calls=(ToolCall(id="t1", name="shell", input={}),),
        stop_reason="tool_use",
        usage=TokenUsage(input_tokens=1, output_tokens=1),
        thinking="r",
        thinking_blocks=(thinking, redacted),
    )

    state = apply_response_to_state(AgentState(), response)

    content = state.messages[-1]["content"]
    assert [b["type"] for b in content] == [
        "thinking",
        "redacted_thinking",
        "text",
        "tool_use",
    ]
    assert content[0] == thinking
    assert content[1] == redacted


def test_apply_response_with_only_thinking_adds_no_message() -> None:
    response = LLMResponse(
        text="",
        tool_calls=(),
        stop_reason="end_turn",
        usage=TokenUsage(input_tokens=1, output_tokens=1),
        thinking_blocks=({"type": "thinking", "thinking": "r", "signature": "s"},),
    )

    state = apply_response_to_state(AgentState(), response)

    assert state.messages == ()


class _Stream:
    def __init__(self, final_message: SimpleNamespace) -> None:
        self._final = final_message

    def __aiter__(self):
        return self

    async def __anext__(self):
        raise StopAsyncIteration

    async def get_final_message(self) -> SimpleNamespace:
        return self._final


class _StreamCtx:
    def __init__(self, stream: _Stream) -> None:
        self._stream = stream

    async def __aenter__(self) -> _Stream:
        return self._stream

    async def __aexit__(self, *exc) -> bool:
        return False


async def test_stream_path_captures_thinking_blocks() -> None:
    final = _response_with_thinking()
    client = AnthropicClient.__new__(AnthropicClient)
    client._default_model = "m"
    client._default_max_tokens = 1024
    client._client = SimpleNamespace(
        messages=SimpleNamespace(stream=lambda **kw: _StreamCtx(_Stream(final)))
    )

    parsed = await client.create_message_stream(
        system="s",
        messages=[{"role": "user", "content": "hi"}],
        thinking_budget=2048,
    )

    assert parsed.thinking_blocks[0]["signature"] == "sig-1"
    assert parsed.thinking_blocks[1]["type"] == "redacted_thinking"
