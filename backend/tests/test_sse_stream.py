"""Tests for the long-lived conversation SSE generator."""

from __future__ import annotations

import asyncio

import pytest

from api import sse
from api.events import AgentEvent, EventEmitter, EventType
from api.models import ConversationEntry


def _make_entry() -> ConversationEntry:
    return ConversationEntry(
        emitter=EventEmitter(conversation_id="c1"),
        event_queue=asyncio.Queue(),
        orchestrator=None,
        executor=None,
        pending_callbacks={},
    )


async def test_keepalive_interval_is_shorter_than_common_idle_timeouts() -> None:
    # undici's default body timeout is 300s and many proxies cut idle
    # connections at 60s, so keepalives must arrive well before either.
    assert sse.SSE_KEEPALIVE_INTERVAL_S <= 30


async def test_idle_stream_yields_keepalive_comment(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(sse, "SSE_KEEPALIVE_INTERVAL_S", 0.01)
    entry = _make_entry()
    gen = sse._event_generator("c1", entry)

    chunk = await asyncio.wait_for(anext(gen), timeout=1)

    assert chunk == ": keepalive\n\n"
    await gen.aclose()


async def test_simultaneous_clients_receive_the_same_events() -> None:
    entry = _make_entry()
    first = sse._event_generator("c1", entry)
    second = sse._event_generator("c1", entry)
    tasks = [asyncio.create_task(anext(first)), asyncio.create_task(anext(second))]
    try:
        await asyncio.sleep(0)
        entry.event_queue.put_nowait(
            AgentEvent(type=EventType.TOOL_RESULT, data={"tool_id": "t1"})
        )
        chunks = await asyncio.wait_for(asyncio.gather(*tasks), timeout=1)
        assert chunks[0] == chunks[1]
        assert chunks[0].startswith("event: tool_result\n")
    finally:
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)
        await first.aclose()
        await second.aclose()


async def test_connecting_during_queue_write_does_not_steal_event() -> None:
    entry = _make_entry()
    first = sse._event_generator("c1", entry)
    second = sse._event_generator("c1", entry)
    first_next = asyncio.create_task(anext(first))
    for _ in range(3):
        await asyncio.sleep(0)
    second_next = asyncio.create_task(anext(second))
    entry.event_queue.put_nowait(
        AgentEvent(type=EventType.TOOL_RESULT, data={"tool_id": "race"})
    )
    try:
        chunks = await asyncio.wait_for(
            asyncio.gather(first_next, second_next), timeout=1
        )
        assert chunks[0] == chunks[1]
        assert '"race"' in chunks[1]
    finally:
        first_next.cancel()
        second_next.cancel()
        await asyncio.gather(first_next, second_next, return_exceptions=True)
        await first.aclose()
        await second.aclose()


async def test_disconnecting_one_client_keeps_other_client_live() -> None:
    entry = _make_entry()
    first = sse._event_generator("c1", entry)
    second = sse._event_generator("c1", entry)
    tasks = [asyncio.create_task(anext(first)), asyncio.create_task(anext(second))]
    await asyncio.sleep(0)
    entry.event_queue.put_nowait(AgentEvent(type=EventType.TURN_START, data={}))
    await asyncio.wait_for(asyncio.gather(*tasks), timeout=1)
    broadcaster = entry.stream_task
    await first.aclose()
    assert entry.stream_task is broadcaster
    assert broadcaster is not None and not broadcaster.done()
    entry.event_queue.put_nowait(AgentEvent(type=EventType.TOOL_RESULT, data={}))
    assert (await asyncio.wait_for(anext(second), timeout=1)).startswith(
        "event: tool_result\n"
    )
    await second.aclose()
    assert broadcaster.done()
    assert entry.stream_task is None
    assert not entry.stream_queues


async def test_last_disconnect_restores_unread_events_before_offline_backlog() -> None:
    entry = _make_entry()
    gen = sse._event_generator("c1", entry)
    first_next = asyncio.create_task(anext(gen))
    await asyncio.sleep(0)
    entry.event_queue.put_nowait(AgentEvent(type=EventType.TURN_START, data={}))
    await asyncio.wait_for(first_next, timeout=1)
    entry.event_queue.put_nowait(
        AgentEvent(type=EventType.TOOL_CALL, data={"tool_id": "t1"})
    )
    await asyncio.sleep(0)  # broadcaster delivers while the client is paused
    entry.event_queue.put_nowait(
        AgentEvent(type=EventType.TOOL_RESULT, data={"tool_id": "t1"})
    )
    await gen.aclose()  # cancels the broadcaster before it reads the second event
    assert entry.event_queue.qsize() == 2
    reconnected = sse._event_generator("c1", entry)
    try:
        assert (await asyncio.wait_for(anext(reconnected), 1)).startswith(
            "event: tool_call\n"
        )
        assert (await asyncio.wait_for(anext(reconnected), 1)).startswith(
            "event: tool_result\n"
        )
    finally:
        await reconnected.aclose()


async def test_cancelled_pending_reader_leaves_event_for_reconnect() -> None:
    entry = _make_entry()
    gen = sse._event_generator("c1", entry)
    pending = asyncio.create_task(anext(gen))
    for _ in range(3):
        await asyncio.sleep(0)
    entry.event_queue.put_nowait(AgentEvent(type=EventType.TOOL_RESULT, data={}))
    await asyncio.sleep(0)  # broadcast completes, pending client has not resumed
    pending.cancel()
    await asyncio.gather(pending, return_exceptions=True)
    assert entry.event_queue.qsize() == 1
    assert entry.stream_task is None
    reconnected = sse._event_generator("c1", entry)
    try:
        assert (await asyncio.wait_for(anext(reconnected), 1)).startswith(
            "event: tool_result\n"
        )
    finally:
        await reconnected.aclose()


async def test_callback_request_id_is_shared_between_clients() -> None:
    entry = _make_entry()
    subscriber = sse._create_queue_subscriber(
        entry.event_queue, entry.pending_callbacks
    )
    entry.emitter.subscribe(subscriber)
    first = sse._event_generator("c1", entry)
    second = sse._event_generator("c1", entry)
    tasks = [asyncio.create_task(anext(first)), asyncio.create_task(anext(second))]
    await asyncio.sleep(0)

    def callback(response: str) -> None:
        pass

    await entry.emitter.emit(
        EventType.ASK_USER, {"question": "Continue?", "response_callback": callback}
    )
    chunks = await asyncio.wait_for(asyncio.gather(*tasks), timeout=1)
    assert chunks[0] == chunks[1]
    assert len(entry.pending_callbacks) == 1
    request_id = next(iter(entry.pending_callbacks))
    assert request_id in chunks[0]
    assert entry.pending_callbacks[request_id] is callback
    await first.aclose()
    await second.aclose()


async def test_slow_client_queue_is_bounded_without_blocking_other_client() -> None:
    entry = _make_entry()
    entry.event_queue = asyncio.Queue(maxsize=2)
    slow = sse._event_generator("c1", entry)
    fast = sse._event_generator("c1", entry)
    tasks = [asyncio.create_task(anext(slow)), asyncio.create_task(anext(fast))]
    await asyncio.sleep(0)
    entry.event_queue.put_nowait(AgentEvent(type=EventType.TURN_START, data={}))
    await asyncio.wait_for(asyncio.gather(*tasks), timeout=1)
    try:
        for i in range(4):
            entry.event_queue.put_nowait(
                AgentEvent(type=EventType.TEXT_DELTA, data={"delta": str(i)})
            )
            assert '"delta"' in await asyncio.wait_for(anext(fast), 1)
        entry.event_queue.put_nowait(AgentEvent(type=EventType.TURN_COMPLETE, data={}))
        assert (await asyncio.wait_for(anext(fast), 1)).startswith(
            "event: turn_complete\n"
        )
        assert max(queue.qsize() for queue in entry.stream_queues) == 2
        assert (await asyncio.wait_for(anext(slow), 1)).startswith(
            "event: text_delta\n"
        )
        assert (await asyncio.wait_for(anext(slow), 1)).startswith(
            "event: turn_complete\n"
        )
    finally:
        await slow.aclose()
        await fast.aclose()


async def test_conversation_end_reaches_all_clients() -> None:
    entry = _make_entry()
    first = sse._event_generator("c1", entry)
    second = sse._event_generator("c1", entry)
    tasks = [asyncio.create_task(anext(first)), asyncio.create_task(anext(second))]
    await asyncio.sleep(0)
    entry.event_queue.put_nowait(None)
    chunks = await asyncio.wait_for(asyncio.gather(*tasks), timeout=1)
    assert chunks == ["event: done\ndata: {}\n\n"] * 2
    await first.aclose()
    await second.aclose()
    assert entry.stream_task is None


async def test_conversation_cleanup_closes_stream_and_broadcaster() -> None:
    from types import SimpleNamespace

    from api.routes.conversations import _cleanup_conversation

    entry = _make_entry()
    gen = sse._event_generator("c1", entry)
    pending = asyncio.create_task(anext(gen))
    await asyncio.sleep(0)
    entry.event_queue.put_nowait(AgentEvent(type=EventType.TURN_START, data={}))
    await asyncio.wait_for(pending, 1)
    broadcaster = entry.stream_task
    try:
        await _cleanup_conversation(SimpleNamespace(conversations={"c1": entry}), "c1")
        assert await asyncio.wait_for(anext(gen), 1) == "event: done\ndata: {}\n\n"
        assert broadcaster is not None and broadcaster.done()
    finally:
        await gen.aclose()


async def test_conversation_end_reaches_a_full_structural_queue() -> None:
    entry = _make_entry()
    entry.event_queue = asyncio.Queue(maxsize=1)
    gen = sse._event_generator("c1", entry)
    pending = asyncio.create_task(anext(gen))
    await asyncio.sleep(0)
    entry.event_queue.put_nowait(AgentEvent(type=EventType.TURN_START, data={}))
    await asyncio.wait_for(pending, 1)
    try:
        entry.event_queue.put_nowait(AgentEvent(type=EventType.TOOL_RESULT, data={}))
        await asyncio.sleep(0)
        entry.event_queue.put_nowait(None)
        await asyncio.sleep(0)
        assert await asyncio.wait_for(anext(gen), 1) == "event: done\ndata: {}\n\n"
    finally:
        await gen.aclose()
