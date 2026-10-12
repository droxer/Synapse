"""Conversation route turn lifecycle: cancel, retry, reconstruction, eviction."""

from __future__ import annotations

import asyncio
import os
import time
import uuid
from contextlib import asynccontextmanager
from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock

import pytest

os.environ.setdefault("ANTHROPIC_API_KEY", "test-key")
os.environ.setdefault("TAVILY_API_KEY", "test-key")

import api.routes.conversations as conversation_routes  # noqa: E402
from agent.memory.conversation_hooks import (  # noqa: E402
    SESSION_VALUE_MEMORY_ENTRIES,
    SESSION_VALUE_PERSISTENT_STORE,
)
from agent.runtime.hooks import (  # noqa: E402
    CompositeConversationHooks,
    ConversationSessionHookResult,
    ConversationTurnContext,
    NoopConversationHooks,
)
from agent.runtime.orchestrator import AgentOrchestrator  # noqa: E402
from agent.tools.registry import ToolRegistry  # noqa: E402
from api.conversation_lifecycle import (  # noqa: E402
    RESUMED_CONVERSATION_PLACEHOLDER,
    TurnInfo,
    forget_activity,
    normalize_reconstructed_messages,
    touch_activity,
)
from api.events import AgentEvent, EventEmitter, EventType  # noqa: E402
from api.models import ConversationEntry  # noqa: E402
from tests.test_harness_g5_orchestrator_turns import (  # noqa: E402
    _FakeExecutor,
    _GatedClient,
)


@asynccontextmanager
async def _session_factory():
    yield object()


def _entry(orchestrator: Any, executor: Any = None) -> ConversationEntry:
    return ConversationEntry(
        emitter=EventEmitter(),
        event_queue=asyncio.Queue(),
        orchestrator=orchestrator,
        executor=executor if executor is not None else AsyncMock(),
        pending_callbacks={},
    )


def _state(conversations: dict[str, ConversationEntry], **extra: Any) -> Any:
    values: dict[str, Any] = {
        "conversations": conversations,
        "db_session_factory": _session_factory,
        "conversation_hooks": NoopConversationHooks(),
    }
    values.update(extra)
    return SimpleNamespace(**values)


def _real_orchestrator_entry(
    client: _GatedClient,
) -> tuple[ConversationEntry, AgentOrchestrator, list[AgentEvent]]:
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
    entry = ConversationEntry(
        emitter=emitter,
        event_queue=asyncio.Queue(),
        orchestrator=orchestrator,
        executor=AsyncMock(),
        pending_callbacks={},
    )
    return entry, orchestrator, events


def _user_texts(orchestrator: AgentOrchestrator) -> list[str]:
    return [
        m["content"]
        for m in orchestrator._state.messages
        if m["role"] == "user" and isinstance(m["content"], str)
    ]


def _start_turn(
    state: Any,
    entry: ConversationEntry,
    conversation_id: str,
    message: str,
    turn_id: str,
) -> None:
    conversation_routes._start_identified_turn(
        entry,
        conversation_routes._run_turn(
            state,
            conversation_id,
            entry.orchestrator,
            message,
            turn_id=turn_id,
        ),
        idempotency_key=None,
        turn_info=TurnInfo(turn_id=turn_id, message=message),
    )


# ---------------------------------------------------------------------------
# Defect 1: stale cancel after hard cancel
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_hard_cancel_via_route_does_not_cancel_next_turn(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(conversation_routes, "_CANCEL_GRACE_SECONDS", 0.05)
    conversation_id = str(uuid.uuid4())
    client = _GatedClient()
    entry, orchestrator, events = _real_orchestrator_entry(client)
    state = _state({conversation_id: entry})

    client.gate.clear()
    _start_turn(state, entry, conversation_id, "first", "t1")
    await client.entered.wait()

    response = await conversation_routes.cancel_turn(
        conversation_id=conversation_id, state=state, auth_user=None
    )
    assert response == {"status": "cancelling"}
    assert entry.turn_task is not None
    await asyncio.wait_for(entry.turn_task, timeout=2)
    assert orchestrator._state.messages == ()

    client.gate.set()
    events.clear()
    result = await conversation_routes._run_turn(
        state, conversation_id, orchestrator, "second", turn_id="t2"
    )

    assert result == "reply 2"
    assert EventType.TURN_CANCELLED not in [event.type for event in events]


# ---------------------------------------------------------------------------
# Defect 2: retry while a turn is running
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_retry_while_running_retries_in_flight_turn_and_keeps_history() -> None:
    conversation_id = str(uuid.uuid4())
    client = _GatedClient()
    entry, orchestrator, events = _real_orchestrator_entry(client)
    state = _state({conversation_id: entry})

    await conversation_routes._run_turn(
        state, conversation_id, orchestrator, "first", turn_id="t1"
    )
    client.gate.clear()
    client.entered.clear()
    _start_turn(state, entry, conversation_id, "second", "t2")
    await client.entered.wait()

    async def _release_soon() -> None:
        await asyncio.sleep(0.01)
        client.gate.set()

    release = asyncio.create_task(_release_soon())
    events.clear()
    response = await conversation_routes.retry_turn(
        conversation_id=conversation_id, state=state, auth_user=None
    )
    await release
    assert entry.turn_task is not None
    await entry.turn_task

    assert response == {"status": "retrying", "message": "second"}
    assert _user_texts(orchestrator) == ["first", "second"]
    retry_starts = [
        e for e in events if e.type == EventType.TURN_START and e.data.get("retry")
    ]
    assert len(retry_starts) == 1
    assert retry_starts[0].data["message"] == "second"


@pytest.mark.asyncio
async def test_retry_after_hard_cancel_retries_in_flight_turn(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(conversation_routes, "_CANCEL_GRACE_SECONDS", 0.05)
    conversation_id = str(uuid.uuid4())
    client = _GatedClient()
    entry, orchestrator, _events = _real_orchestrator_entry(client)
    state = _state({conversation_id: entry})

    await conversation_routes._run_turn(
        state, conversation_id, orchestrator, "first", turn_id="t1"
    )
    client.gate.clear()
    client.entered.clear()
    _start_turn(state, entry, conversation_id, "second", "t2")
    await client.entered.wait()

    response = await conversation_routes.retry_turn(
        conversation_id=conversation_id, state=state, auth_user=None
    )
    client.gate.set()
    assert entry.turn_task is not None
    await entry.turn_task

    assert response["message"] == "second"
    assert _user_texts(orchestrator) == ["first", "second"]


@pytest.mark.asyncio
async def test_retry_after_completed_turn_replaces_only_that_exchange() -> None:
    conversation_id = str(uuid.uuid4())
    client = _GatedClient()
    entry, orchestrator, _events = _real_orchestrator_entry(client)
    state = _state({conversation_id: entry})

    await conversation_routes._run_turn(
        state, conversation_id, orchestrator, "first", turn_id="t1"
    )
    _start_turn(state, entry, conversation_id, "second", "t2")
    assert entry.turn_task is not None
    await entry.turn_task

    response = await conversation_routes.retry_turn(
        conversation_id=conversation_id, state=state, auth_user=None
    )
    await entry.turn_task

    assert response["message"] == "second"
    assert _user_texts(orchestrator) == ["first", "second"]
    assert len(orchestrator._state.messages) == 4


# ---------------------------------------------------------------------------
# Defect 3: concurrent reconstruction is single-flight
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_concurrent_reconstruction_builds_one_entry(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conversation_id = str(uuid.uuid4())
    state = _state({})
    calls = 0

    async def _fake_once(state: Any, cid: str, *, compaction_runtime=None) -> Any:
        nonlocal calls
        del compaction_runtime
        calls += 1
        await asyncio.sleep(0.01)
        entry = _entry(AsyncMock())
        state.conversations[cid] = entry
        return entry

    monkeypatch.setattr(
        conversation_routes, "_reconstruct_conversation_once", _fake_once
    )

    first, second = await asyncio.gather(
        conversation_routes._reconstruct_conversation(state, conversation_id),
        conversation_routes._reconstruct_conversation(state, conversation_id),
    )

    assert calls == 1
    assert first is second
    assert state.conversations[conversation_id] is first


@pytest.mark.asyncio
async def test_failed_reconstruction_is_shared_then_retryable(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conversation_id = str(uuid.uuid4())
    state = _state({})
    calls = 0

    async def _fake_once(state: Any, cid: str, *, compaction_runtime=None) -> Any:
        nonlocal calls
        del compaction_runtime
        calls += 1
        await asyncio.sleep(0.01)
        if calls == 1:
            raise RuntimeError("db down")
        entry = _entry(AsyncMock())
        state.conversations[cid] = entry
        return entry

    monkeypatch.setattr(
        conversation_routes, "_reconstruct_conversation_once", _fake_once
    )

    results = await asyncio.gather(
        conversation_routes._reconstruct_conversation(state, conversation_id),
        conversation_routes._reconstruct_conversation(state, conversation_id),
        return_exceptions=True,
    )
    assert calls == 1
    assert all(isinstance(r, RuntimeError) for r in results)

    entry = await conversation_routes._reconstruct_conversation(state, conversation_id)
    assert calls == 2
    assert entry is state.conversations[conversation_id]


# ---------------------------------------------------------------------------
# Defect 4: mode switch cleans up the replaced executor
# ---------------------------------------------------------------------------


class _DummyRequest:
    def __init__(self, payload: dict[str, object]) -> None:
        self.headers = {"content-type": "application/json"}
        self._payload = payload
        self.cookies: dict[str, str] = {}

    async def json(self) -> dict[str, object]:
        return self._payload


class _SessionHooks(NoopConversationHooks):
    async def before_session_start(self, context: Any) -> Any:
        del context
        return ConversationSessionHookResult(
            {
                SESSION_VALUE_PERSISTENT_STORE: object(),
                SESSION_VALUE_MEMORY_ENTRIES: [],
            }
        )


@pytest.mark.asyncio
async def test_mode_switch_cleans_up_previous_executor(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    conversation_id = str(uuid.uuid4())
    old_executor = AsyncMock()
    new_executor = AsyncMock()
    planner = AsyncMock()
    planner.run.return_value = "ok"
    entry = _entry(AsyncMock(), executor=old_executor)
    state = _state(
        {conversation_id: entry},
        conversation_hooks=_SessionHooks(),
        claude_client=object(),
        sandbox_provider=object(),
        storage_backend=object(),
        mcp_state=None,
        db_repo=SimpleNamespace(
            get_conversation=AsyncMock(
                return_value=SimpleNamespace(
                    id=uuid.UUID(conversation_id),
                    user_id=None,
                    orchestrator_mode=conversation_routes.ORCHESTRATOR_AGENT,
                    context_summary=None,
                )
            ),
            update_conversation=AsyncMock(),
        ),
    )
    monkeypatch.setattr(
        conversation_routes,
        "_resolve_execution_route",
        AsyncMock(
            return_value=(
                conversation_routes.EXECUTION_SHAPE_ORCHESTRATOR_WORKERS,
                "planner requested",
                conversation_routes.ORCHESTRATOR_PLANNER,
                False,
            )
        ),
    )
    monkeypatch.setattr(
        conversation_routes, "_build_user_skill_registry", AsyncMock(return_value=None)
    )
    monkeypatch.setattr(
        conversation_routes,
        "resolve_compaction_profile",
        lambda settings, runtime: SimpleNamespace(),
    )
    monkeypatch.setattr(
        conversation_routes,
        "_load_initial_messages_for_conversation",
        AsyncMock(return_value=[]),
    )
    monkeypatch.setattr(
        conversation_routes,
        "_build_planner_orchestrator",
        lambda *args, **kwargs: (planner, new_executor),
    )

    await conversation_routes.send_message(
        _DummyRequest({"message": "plan with workers", "planner": True}),
        conversation_id=conversation_id,
        state=state,
        auth_user=None,
    )
    assert entry.turn_task is not None
    await entry.turn_task

    assert entry.executor is new_executor
    old_executor.cleanup.assert_awaited_once()
    new_executor.cleanup.assert_not_awaited()


# ---------------------------------------------------------------------------
# Defect 5: stale sweep uses last activity and re-checks under the lock
# ---------------------------------------------------------------------------


def _aged_entry(conversation_id: str, now: float) -> ConversationEntry:
    orchestrator = SimpleNamespace(
        background_task_manager=SimpleNamespace(cancel_all=AsyncMock())
    )
    entry = _entry(orchestrator)
    entry.created_at = now - 7200
    forget_activity(conversation_id)
    return entry


@pytest.mark.asyncio
async def test_sweep_keeps_recently_active_conversation() -> None:
    now = time.monotonic()
    conversation_id = str(uuid.uuid4())
    entry = _aged_entry(conversation_id, now)
    touch_activity(conversation_id, now - 10)
    state = _state({conversation_id: entry})

    evicted = await conversation_routes._sweep_stale_conversations(state, now=now)

    assert evicted == []
    assert state.conversations[conversation_id] is entry


@pytest.mark.asyncio
async def test_sweep_evicts_idle_conversation_and_stops_background_tasks() -> None:
    now = time.monotonic()
    conversation_id = str(uuid.uuid4())
    entry = _aged_entry(conversation_id, now)
    state = _state({conversation_id: entry})

    evicted = await conversation_routes._sweep_stale_conversations(state, now=now)

    assert evicted == [conversation_id]
    assert conversation_id not in state.conversations
    entry.executor.cleanup.assert_awaited_once()
    entry.orchestrator.background_task_manager.cancel_all.assert_awaited_once()


@pytest.mark.asyncio
async def test_sweep_rechecks_activity_under_entry_lock() -> None:
    now = time.monotonic()
    conversation_id = str(uuid.uuid4())
    entry = _aged_entry(conversation_id, now)
    state = _state({conversation_id: entry})

    async with entry.lock:
        sweep = asyncio.create_task(
            conversation_routes._sweep_stale_conversations(state, now=now)
        )
        await asyncio.sleep(0)
        # A message arrives while the sweep waits for the lock.
        touch_activity(conversation_id, now + 1)
    evicted = await sweep

    assert evicted == []
    assert state.conversations[conversation_id] is entry


# ---------------------------------------------------------------------------
# Defect 6: hook isolation and after_turn statuses
# ---------------------------------------------------------------------------


class _FailingHooks:
    async def before_session_start(self, context: Any) -> Any:
        raise RuntimeError("boom")

    async def before_turn(self, context: Any) -> tuple[str, ...]:
        raise RuntimeError("boom")

    async def after_turn(self, context: Any, status: str, result: str) -> None:
        raise RuntimeError("boom")

    async def before_context_compaction(self, context: Any) -> None:
        raise RuntimeError("boom")

    async def after_context_compaction(self, context: Any, result: Any) -> None:
        raise RuntimeError("boom")


class _RecordingHooks:
    def __init__(self) -> None:
        self.calls: list[tuple[str, Any]] = []

    async def before_session_start(self, context: Any) -> Any:
        self.calls.append(("before_session_start", None))
        return ConversationSessionHookResult({"k": "v"})

    async def before_turn(self, context: Any) -> tuple[str, ...]:
        self.calls.append(("before_turn", None))
        return (*context.runtime_prompt_sections, "recorded")

    async def after_turn(self, context: Any, status: str, result: str) -> None:
        self.calls.append(("after_turn", status))

    async def before_context_compaction(self, context: Any) -> None:
        self.calls.append(("before_context_compaction", None))

    async def after_context_compaction(self, context: Any, result: Any) -> None:
        self.calls.append(("after_context_compaction", None))


def _turn_context() -> ConversationTurnContext:
    return ConversationTurnContext(
        conversation_id="c",
        user_id=None,
        turn_id="t",
        message="hi",
        source="web",
        runtime_prompt_sections=("base",),
    )


@pytest.mark.asyncio
async def test_composite_hooks_isolate_failing_hook() -> None:
    recording = _RecordingHooks()
    hooks = CompositeConversationHooks((_FailingHooks(), recording))

    session = await hooks.before_session_start(SimpleNamespace())
    sections = await hooks.before_turn(_turn_context())
    await hooks.after_turn(_turn_context(), "completed", "ok")
    await hooks.before_context_compaction(SimpleNamespace())
    await hooks.after_context_compaction(SimpleNamespace(), SimpleNamespace())

    assert session.values == {"k": "v"}
    assert sections == ("base", "recorded")
    assert [name for name, _ in recording.calls] == [
        "before_session_start",
        "before_turn",
        "after_turn",
        "before_context_compaction",
        "after_context_compaction",
    ]


class _StatusOrchestrator:
    def __init__(self, result: str, status: str) -> None:
        self._result = result
        self._status = status
        self.last_turn_id: str | None = None
        self.last_turn_status: str | None = None

    async def run(self, message: str, **kwargs: Any) -> str:
        del message
        self.last_turn_id = kwargs["turn_metadata"]["turn_id"]
        self.last_turn_status = self._status
        return self._result


class _RaisingOrchestrator:
    def __init__(self, exc: BaseException) -> None:
        self._exc = exc

    async def run(self, message: str, **kwargs: Any) -> str:
        del message, kwargs
        raise self._exc


async def _after_turn_statuses(orchestrator: Any) -> list[str]:
    conversation_id = str(uuid.uuid4())
    hooks = _RecordingHooks()
    entry = _entry(orchestrator)
    state = _state({conversation_id: entry}, conversation_hooks=hooks)
    await conversation_routes._run_turn(
        state, conversation_id, orchestrator, "hello", turn_id="turn-1"
    )
    if entry.background_tasks:
        await asyncio.gather(*entry.background_tasks)
    return [status for name, status in hooks.calls if name == "after_turn"]


@pytest.mark.asyncio
async def test_after_turn_reports_graceful_cancel_as_cancelled() -> None:
    statuses = await _after_turn_statuses(
        _StatusOrchestrator("partial text", "cancelled")
    )
    assert statuses == ["cancelled"]


@pytest.mark.asyncio
async def test_after_turn_reports_error_result() -> None:
    statuses = await _after_turn_statuses(_StatusOrchestrator("Error: x", "error"))
    assert statuses == ["error"]


@pytest.mark.asyncio
async def test_after_turn_reports_hard_cancel_and_exception() -> None:
    assert await _after_turn_statuses(
        _RaisingOrchestrator(asyncio.CancelledError())
    ) == ["cancelled"]
    assert await _after_turn_statuses(_RaisingOrchestrator(RuntimeError("x"))) == [
        "error"
    ]


# ---------------------------------------------------------------------------
# Defect 7: reconstructed history is a valid message chain
# ---------------------------------------------------------------------------


def test_normalize_turns_summary_into_user_context_and_merges_roles() -> None:
    messages = normalize_reconstructed_messages(
        [
            {"role": "assistant", "content": "  "},
            {"role": "user", "content": "A"},
            {"role": "user", "content": "B"},
            {"role": "assistant", "content": "C"},
            {"role": "assistant", "content": [{"type": "text", "text": ""}]},
            {"role": "user", "content": [{"type": "text", "text": "D"}]},
            {"role": "user", "content": "E"},
        ],
        context_summary="S",
    )

    assert [m["role"] for m in messages] == ["user", "assistant", "user"]
    assert messages[0]["content"] == "## Earlier sessions (compressed)\nS\n\nA\n\nB"
    assert messages[1]["content"] == "C"
    assert messages[2]["content"] == [
        {"type": "text", "text": "D"},
        {"type": "text", "text": "E"},
    ]


def test_normalize_prepends_user_message_when_history_starts_with_assistant() -> None:
    messages = normalize_reconstructed_messages(
        [{"role": "assistant", "content": "X"}, {"role": "user", "content": "Y"}]
    )

    assert messages == [
        {"role": "user", "content": RESUMED_CONVERSATION_PLACEHOLDER},
        {"role": "assistant", "content": "X"},
        {"role": "user", "content": "Y"},
    ]


@pytest.mark.asyncio
async def test_load_initial_messages_normalizes_db_history(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    rows = [
        SimpleNamespace(role="user", content={"text": "failed turn"}),
        SimpleNamespace(role="user", content={"text": "retry"}),
        SimpleNamespace(role="assistant", content={"text": "answer"}),
        SimpleNamespace(role="assistant", content={"text": ""}),
    ]
    state = SimpleNamespace(
        db_session_factory=_session_factory,
        db_repo=SimpleNamespace(get_recent_messages=AsyncMock(return_value=rows)),
        claude_client=object(),
    )

    class _NoCompactObserver:
        def __init__(self, **kwargs: Any) -> None:
            del kwargs

        def should_compact(self, messages: Any, system_prompt: str = "") -> bool:
            return False

    monkeypatch.setattr(conversation_routes, "Observer", _NoCompactObserver)
    monkeypatch.setattr(
        conversation_routes,
        "build_agent_system_prompt",
        lambda memory_entries, user_skill_registry: "",
    )

    messages = await conversation_routes._load_initial_messages_for_conversation(
        state,
        SimpleNamespace(id=uuid.uuid4(), context_summary="old stuff"),
        [],
        None,
        SimpleNamespace(reconstruct_tail_messages=12, summary_model="m"),
    )

    assert [m["role"] for m in messages] == ["user", "assistant"]
    assert messages[0]["content"].startswith("## Earlier sessions (compressed)\n")
    assert "failed turn" in messages[0]["content"]
    assert "retry" in messages[0]["content"]
    assert messages[1]["content"] == "answer"
