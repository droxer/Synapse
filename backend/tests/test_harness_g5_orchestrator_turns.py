"""Turn identity, cancellation and rollback in AgentOrchestrator."""

from __future__ import annotations

import asyncio
import os
from typing import Any

import pytest

os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("TAVILY_API_KEY", "test-key")

from agent.llm.client import LLMResponse, TokenUsage  # noqa: E402
from agent.runtime.orchestrator import AgentOrchestrator  # noqa: E402
from agent.tools.registry import ToolRegistry  # noqa: E402
from api.events import AgentEvent, EventEmitter, EventType  # noqa: E402


class _GatedClient:
    """Fake LLM client; calls block while ``gate`` is cleared."""

    default_model = "test-model"

    def __init__(self) -> None:
        self.gate = asyncio.Event()
        self.gate.set()
        self.entered = asyncio.Event()
        self.calls = 0

    async def create_message_stream(self, **kwargs: Any) -> LLMResponse:
        del kwargs
        self.calls += 1
        self.entered.set()
        await self.gate.wait()
        return LLMResponse(
            text=f"reply {self.calls}",
            tool_calls=(),
            stop_reason="end_turn",
            usage=TokenUsage(input_tokens=1, output_tokens=1),
        )


class _FakeExecutor:
    def reset_turn_quotas(self) -> None:
        return None

    def reset_sandbox_template(self) -> None:
        return None


def _build(
    client: _GatedClient,
) -> tuple[AgentOrchestrator, list[AgentEvent]]:
    emitter = EventEmitter()
    events: list[AgentEvent] = []

    async def _record(event: AgentEvent) -> None:
        events.append(event)

    emitter.subscribe(_record)
    orchestrator = AgentOrchestrator(
        claude_client=client,  # type: ignore[arg-type]
        tool_registry=ToolRegistry(),
        tool_executor=_FakeExecutor(),  # type: ignore[arg-type]
        event_emitter=emitter,
        system_prompt="test",
    )
    return orchestrator, events


def _types(events: list[AgentEvent]) -> list[EventType]:
    return [event.type for event in events]


def _user_texts(orchestrator: AgentOrchestrator) -> list[str]:
    return [
        m["content"]
        for m in orchestrator._state.messages
        if m["role"] == "user" and isinstance(m["content"], str)
    ]


@pytest.mark.asyncio
async def test_hard_cancelled_turn_does_not_cancel_next_turn() -> None:
    client = _GatedClient()
    orchestrator, events = _build(client)
    client.gate.clear()

    task = asyncio.create_task(
        orchestrator.run("first", turn_metadata={"turn_id": "t1"})
    )
    await client.entered.wait()
    orchestrator.cancel(turn_id="t1")
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task

    # Hard cancel leaves state like a graceful cancel: the turn is rewound.
    assert orchestrator._state.messages == ()
    assert orchestrator.last_turn_status == "cancelled"

    client.gate.set()
    events.clear()
    result = await orchestrator.run("second", turn_metadata={"turn_id": "t2"})

    assert result == "reply 2"
    assert EventType.TURN_COMPLETE in _types(events)
    assert EventType.TURN_CANCELLED not in _types(events)
    assert orchestrator.last_turn_status == "completed"


@pytest.mark.asyncio
async def test_legacy_cancel_without_running_turn_is_ignored() -> None:
    client = _GatedClient()
    orchestrator, events = _build(client)

    orchestrator.cancel()
    result = await orchestrator.run("hello")

    assert result == "reply 1"
    assert EventType.TURN_CANCELLED not in _types(events)


@pytest.mark.asyncio
async def test_cancel_for_finished_turn_is_ignored() -> None:
    client = _GatedClient()
    orchestrator, events = _build(client)
    await orchestrator.run("first", turn_metadata={"turn_id": "t1"})

    orchestrator.cancel(turn_id="t1")
    events.clear()
    result = await orchestrator.run("second", turn_metadata={"turn_id": "t2"})

    assert result == "reply 2"
    assert EventType.TURN_CANCELLED not in _types(events)


@pytest.mark.asyncio
async def test_cancel_requested_before_turn_starts_targets_that_turn() -> None:
    client = _GatedClient()
    orchestrator, events = _build(client)

    orchestrator.cancel(turn_id="t1")
    await orchestrator.run("first", turn_metadata={"turn_id": "t1"})

    assert EventType.TURN_CANCELLED in _types(events)
    assert client.calls == 0
    assert orchestrator.last_turn_status == "cancelled"
    assert orchestrator._state.messages == ()


@pytest.mark.asyncio
async def test_graceful_cancel_reports_cancelled_status() -> None:
    client = _GatedClient()
    orchestrator, events = _build(client)
    client.gate.clear()

    task = asyncio.create_task(
        orchestrator.run("first", turn_metadata={"turn_id": "t1"})
    )
    await client.entered.wait()
    assert orchestrator.active_turn_id == "t1"
    orchestrator.cancel(turn_id="t1")
    client.gate.set()
    await task

    assert orchestrator.last_turn_status == "cancelled"
    assert orchestrator.last_turn_user_message == "first"
    assert orchestrator.active_turn_id is None
    assert EventType.TURN_CANCELLED in _types(events)


@pytest.mark.asyncio
async def test_rollback_turn_is_scoped_to_last_turn_and_idempotent() -> None:
    client = _GatedClient()
    orchestrator, _events = _build(client)
    await orchestrator.run("first", turn_metadata={"turn_id": "t1"})
    await orchestrator.run("second", turn_metadata={"turn_id": "t2"})

    assert orchestrator.rollback_turn("t1") is False
    assert _user_texts(orchestrator) == ["first", "second"]

    assert orchestrator.rollback_turn("t2") is True
    assert _user_texts(orchestrator) == ["first"]
    assert len(orchestrator._state.messages) == 2

    assert orchestrator.rollback_turn("t2") is False
    assert _user_texts(orchestrator) == ["first"]


@pytest.mark.asyncio
async def test_turn_start_payload_carries_turn_metadata() -> None:
    client = _GatedClient()
    orchestrator, events = _build(client)

    await orchestrator.run("again", turn_metadata={"turn_id": "t9", "retry": True})

    turn_start = next(e for e in events if e.type == EventType.TURN_START)
    assert turn_start.data["turn_id"] == "t9"
    assert turn_start.data["retry"] is True
