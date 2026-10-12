"""finalize_conversation_turn: roll back history on non-retryable errors."""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from agent.runtime.helpers import classify_turn_error, finalize_conversation_turn
from agent.runtime.orchestrator import AgentState
from api.events import EventEmitter, EventType

_BASE: tuple[dict[str, Any], ...] = (
    {"role": "user", "content": "earlier"},
    {"role": "assistant", "content": [{"type": "text", "text": "earlier reply"}]},
)
_TURN: tuple[dict[str, Any], ...] = (
    {"role": "user", "content": "huge pasted content"},
    {
        "role": "assistant",
        "content": [{"type": "tool_use", "id": "t1", "name": "x", "input": {}}],
    },
    {"role": "user", "content": [{"type": "tool_result", "tool_use_id": "t1"}]},
)


async def _finalize(error: str) -> tuple[str, AgentState, list[Any]]:
    emitter = EventEmitter()
    events: list[Any] = []

    async def _sub(event: Any) -> None:
        events.append(event)

    emitter.subscribe(_sub)
    state = AgentState(messages=(*_BASE, *_TURN)).mark_error(error)
    text, new_state = await finalize_conversation_turn(
        state=state,
        cancel_event=asyncio.Event(),
        current_turn_messages=_TURN,
        base_messages=_BASE,
        emitter=emitter,
        artifact_ids=[],
    )
    return text, new_state, events


@pytest.mark.parametrize(
    "error",
    [
        "LLM content policy rejection: Model provider rejected the request",
        "LLM call failed: Error code: 400 - {'type': 'error', 'error': "
        "{'type': 'invalid_request_error', 'message': 'prompt is too long: "
        "210000 tokens > 200000 maximum'}}",
        "LLM call failed: Error code: 400 - messages.3: tool_use ids were found "
        "without tool_result blocks immediately after",
        "LLM call failed: context_length_exceeded",
        "LLM call failed: Error code: 413 - request too large",
    ],
)
async def test_non_retryable_request_errors_roll_back_to_base(error: str) -> None:
    text, new_state, events = await _finalize(error)

    assert text.startswith("Error:")
    assert new_state.messages == _BASE
    assert new_state.error == error
    task_errors = [e for e in events if e.type == EventType.TASK_ERROR]
    assert task_errors and task_errors[0].data["retryable"] is False


@pytest.mark.parametrize(
    "error",
    [
        "LLM call failed: Connection error.",
        "LLM call failed: Error code: 529 - overloaded",
        "Exceeded maximum iterations (50)",
    ],
)
async def test_other_errors_keep_state(error: str) -> None:
    _, new_state, _ = await _finalize(error)

    assert new_state.messages == (*_BASE, *_TURN)


def test_classify_retryable_transient_llm_error() -> None:
    assert classify_turn_error("LLM call failed: Connection error.") == (
        "llm_error",
        True,
    )


def test_classify_prompt_too_long_is_not_retryable() -> None:
    code, retryable = classify_turn_error(
        "LLM call failed: Error code: 400 - prompt is too long"
    )
    assert code == "llm_error"
    assert retryable is False
