"""SSE (Server-Sent Events) helpers for streaming agent events."""

from __future__ import annotations

import asyncio
import json
import uuid
from collections.abc import AsyncGenerator
from typing import Any

from loguru import logger

from api.events import AgentEvent, EventType
from api.models import ConversationEntry

# Must stay well below proxy idle timeouts (nginx 60s, undici bodyTimeout 300s).
SSE_KEEPALIVE_INTERVAL_S = 15.0

_NON_LOSSY_SSE_EVENTS = {
    EventType.ASK_USER,
    EventType.USER_RESPONSE,
    EventType.LLM_RESPONSE,
    EventType.MESSAGE_USER,
    EventType.TURN_COMPLETE,
    EventType.TURN_CANCELLED,
    EventType.TASK_COMPLETE,
    EventType.TASK_ERROR,
    EventType.TOOL_CALL,
    EventType.TOOL_RESULT,
    EventType.AGENT_SPAWN,
    EventType.AGENT_COMPLETE,
    EventType.AGENT_HANDOFF,
    EventType.AGENT_STAGE_TRANSITION,
    EventType.AGENT_SKIPPED,
    EventType.AGENT_REPLAN_REQUIRED,
    EventType.PLAN_CREATED,
    EventType.PLANNER_AUTO_SELECTED,
}


def _make_room_for_non_lossy_event(queue: asyncio.Queue[AgentEvent | None]) -> bool:
    """Drop one lossy queued item so a structural live event can fit."""
    queued: list[AgentEvent | None] = []
    dropped = False
    for _ in range(queue.qsize()):
        try:
            queued_event = queue.get_nowait()
        except asyncio.QueueEmpty:
            break
        queued_type = getattr(queued_event, "type", None)
        if (
            not dropped
            and queued_event is not None
            and queued_type not in _NON_LOSSY_SSE_EVENTS
        ):
            dropped = True
            continue
        queued.append(queued_event)

    for queued_event in queued:
        try:
            queue.put_nowait(queued_event)
        except asyncio.QueueFull:
            break
    return dropped


def _enqueue_event(
    queue: asyncio.Queue[AgentEvent | None], event: AgentEvent | None
) -> None:
    try:
        queue.put_nowait(event)
    except asyncio.QueueFull:
        if event is None:
            # Shutdown must reach even a stalled client with a structural backlog.
            queue.get_nowait()
            queue.put_nowait(None)
            return
        if event.type in _NON_LOSSY_SSE_EVENTS:
            if _make_room_for_non_lossy_event(queue):
                try:
                    queue.put_nowait(event)
                    return
                except asyncio.QueueFull:
                    pass
            logger.warning(
                "event_queue_full event_type={} — dropping non-lossy live event",
                getattr(event, "type", None),
            )
            return
        logger.warning("event_queue_full event_type={} — dropping event", event.type)


def _create_queue_subscriber(
    queue: asyncio.Queue[AgentEvent | None],
    pending_callbacks: dict[str, Any],
) -> Any:
    """Create an async callback that pushes events into a queue."""

    async def _subscriber(event: AgentEvent) -> None:
        callback = event.data.get("response_callback")
        if callback is not None:
            request_id = event.data.get("request_id") or f"req_{uuid.uuid4().hex[:12]}"
            event = AgentEvent(
                type=event.type,
                data={**event.data, "_request_id": request_id},
                timestamp=event.timestamp,
                iteration=event.iteration,
            )
            pending_callbacks[request_id] = callback
        _enqueue_event(queue, event)

    return _subscriber


async def _broadcast_events(entry: ConversationEntry) -> None:
    """Own the conversation queue and fan out each event without yielding.

    There is no await between dequeue and delivery, so cancellation cannot
    strand an event in a disconnected reader's pending Queue.get task.
    """
    while True:
        event = await entry.event_queue.get()
        for queue in entry.stream_queues:
            _enqueue_event(queue, event)
        if event is None:
            return


def _restore_unread_events(
    source: asyncio.Queue[AgentEvent | None],
    destination: asyncio.Queue[AgentEvent | None],
) -> None:
    """Restore the last client's unread events ahead of the offline backlog."""
    unread = []
    for queue in (source, destination):
        while not queue.empty():
            unread.append(queue.get_nowait())
    for event in unread:
        _enqueue_event(destination, event)


async def _event_generator(
    conversation_id: str,
    entry: ConversationEntry,
) -> AsyncGenerator[str, None]:
    """Stream a private subscription; other clients remain connected.

    A single reader broadcasts the conversation backlog to connected clients.
    With no clients, events stay queued for the next connection.
    """
    queue: asyncio.Queue[AgentEvent | None] = asyncio.Queue(
        maxsize=entry.event_queue.maxsize
    )
    entry.stream_queues.add(queue)
    if entry.stream_task is None:
        entry.stream_task = asyncio.create_task(_broadcast_events(entry))

    try:
        while True:
            try:
                async with asyncio.timeout(SSE_KEEPALIVE_INTERVAL_S):
                    event = await queue.get()
            except TimeoutError:
                yield ": keepalive\n\n"
                continue

            if event is None:
                # Explicit conversation end
                yield "event: done\ndata: {}\n\n"
                break

            payload = _serialize_event(event)
            if event.type == EventType.ASK_USER:
                logger.info("sse_sending_ask_user payload={}", payload[:200])
            yield f"event: {event.type.value}\ndata: {payload}\n\n"
    except (asyncio.CancelledError, GeneratorExit):
        logger.info("sse_client_disconnected conversation_id={}", conversation_id)
    finally:
        entry.stream_queues.remove(queue)
        if not entry.stream_queues:
            task = entry.stream_task
            entry.stream_task = None
            if task is not None:
                task.cancel()
            _restore_unread_events(queue, entry.event_queue)
            if task is not None:
                await asyncio.gather(task, return_exceptions=True)


def _serialize_event(event: AgentEvent) -> str:
    """Serialize an AgentEvent to a JSON string."""
    serializable_data: dict[str, Any] = {}
    for k, v in event.data.items():
        if k == "_request_id":
            serializable_data["request_id"] = v
        elif callable(v):
            continue
        else:
            serializable_data[k] = v

    return json.dumps(
        {
            "event_type": event.type.value,
            "data": serializable_data,
            "timestamp": event.timestamp,
            "iteration": event.iteration,
        },
        default=str,
    )
