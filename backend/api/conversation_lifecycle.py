"""Turn and runtime lifecycle helpers for in-memory conversation entries.

Kept separate from the route module so the turn bookkeeping (turn identity,
activity tracking, single-flight reconstruction, best-effort resource cleanup
and reconstructed-history normalization) can be reasoned about and tested in
isolation.
"""

from __future__ import annotations

import asyncio
import inspect
import time
import weakref
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from typing import Any, cast

from loguru import logger

from agent.runtime.hooks import ConversationTurnStatus
from api.models import FileAttachment

EARLIER_SESSIONS_HEADER = "## Earlier sessions (compressed)\n"
RESUMED_CONVERSATION_PLACEHOLDER = "(Continuing an earlier conversation.)"
_TURN_STATUSES = frozenset({"completed", "cancelled", "error"})


# ---------------------------------------------------------------------------
# Turn identity
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TurnInfo:
    """What a turn task was started with, so cancel/retry can target it."""

    turn_id: str
    message: str
    attachments: tuple[FileAttachment, ...] = ()
    selected_skills: tuple[str, ...] = ()


_TURN_INFO: weakref.WeakKeyDictionary[asyncio.Task[Any], TurnInfo] = (
    weakref.WeakKeyDictionary()
)


def register_turn_info(task: asyncio.Task[Any], info: TurnInfo) -> None:
    _TURN_INFO[task] = info


def get_turn_info(task: asyncio.Task[Any] | None) -> TurnInfo | None:
    if task is None:
        return None
    return _TURN_INFO.get(task)


def _accepts_keyword(func: Callable[..., Any], name: str) -> bool:
    try:
        parameters = inspect.signature(func).parameters
    except (TypeError, ValueError):
        return False
    return name in parameters or any(
        p.kind is inspect.Parameter.VAR_KEYWORD for p in parameters.values()
    )


def signal_cancel(orchestrator: Any, turn_id: str | None) -> None:
    """Ask the orchestrator to cancel ``turn_id`` (or its running turn)."""
    cancel = getattr(orchestrator, "cancel", None)
    if not callable(cancel):
        return
    if turn_id is not None and _accepts_keyword(cancel, "turn_id"):
        cancel(turn_id=turn_id)
        return
    cancel()


def resolve_turn_status(
    orchestrator: Any,
    turn_id: str,
    result: Any,
) -> ConversationTurnStatus:
    """Return the terminal status of ``turn_id``.

    Prefers the orchestrator's own record (it distinguishes a graceful cancel
    that returned partial text from a completion) and falls back to the
    result-string convention used by the routes.
    """
    if getattr(orchestrator, "last_turn_id", None) == turn_id:
        status = getattr(orchestrator, "last_turn_status", None)
        if isinstance(status, str) and status in _TURN_STATUSES:
            return cast(ConversationTurnStatus, status)
    if not isinstance(result, str) or result.startswith("Error:"):
        return "error"
    if result == "Cancelled.":
        return "cancelled"
    return "completed"


# ---------------------------------------------------------------------------
# Activity tracking (stale-entry sweep)
# ---------------------------------------------------------------------------


_LAST_ACTIVITY: dict[str, float] = {}


def touch_activity(conversation_id: str, now: float | None = None) -> None:
    _LAST_ACTIVITY[conversation_id] = time.monotonic() if now is None else now


def forget_activity(conversation_id: str) -> None:
    _LAST_ACTIVITY.pop(conversation_id, None)


def last_activity(conversation_id: str, entry: Any) -> float:
    created_at = float(getattr(entry, "created_at", 0.0))
    return max(created_at, _LAST_ACTIVITY.get(conversation_id, created_at))


def turn_running(entry: Any) -> bool:
    task = getattr(entry, "turn_task", None)
    return task is not None and not task.done()


# ---------------------------------------------------------------------------
# Single-flight reconstruction
# ---------------------------------------------------------------------------


_INFLIGHT: dict[tuple[int, str], asyncio.Task[Any]] = {}


def _consume_task_result(task: asyncio.Task[Any]) -> None:
    if not task.cancelled():
        task.exception()


async def single_flight[T](
    state: Any,
    key: str,
    factory: Callable[[], Awaitable[T]],
) -> T:
    """Run ``factory`` once per (state, key); concurrent callers share it.

    The shared work runs in its own task so one caller disconnecting does not
    abort it for the others. The in-flight slot is released on completion,
    success or failure, so a failed attempt can be retried.
    """
    slot = (id(state), key)
    task = _INFLIGHT.get(slot)
    if task is None:
        task = asyncio.ensure_future(factory())
        _INFLIGHT[slot] = task

        def _release(done: asyncio.Task[Any]) -> None:
            if _INFLIGHT.get(slot) is done:
                _INFLIGHT.pop(slot, None)
            _consume_task_result(done)

        task.add_done_callback(_release)
    return await asyncio.shield(task)


# ---------------------------------------------------------------------------
# Best-effort resource cleanup
# ---------------------------------------------------------------------------


async def cleanup_executor_best_effort(
    executor: Any,
    *,
    conversation_id: str,
    reason: str,
) -> None:
    cleanup = getattr(executor, "cleanup", None)
    if not callable(cleanup):
        return
    try:
        await cleanup()
    except Exception:
        logger.exception(
            "executor_cleanup_failed conversation_id={} reason={}",
            conversation_id,
            reason,
        )


async def shutdown_background_task_managers(
    entry: Any,
    *,
    conversation_id: str,
) -> None:
    """Cancel background tasks owned by the entry's runtime, if exposed.

    Looks for a ``background_task_manager`` attribute with ``cancel_all`` on
    the orchestrator and executor; runtimes that do not expose one are skipped.
    """
    seen: set[int] = set()
    for owner in (
        getattr(entry, "orchestrator", None),
        getattr(entry, "executor", None),
    ):
        manager = getattr(owner, "background_task_manager", None)
        cancel_all = getattr(manager, "cancel_all", None)
        if manager is None or not callable(cancel_all) or id(manager) in seen:
            continue
        seen.add(id(manager))
        try:
            outcome = cancel_all()
            if inspect.isawaitable(outcome):
                await outcome
        except Exception:
            logger.exception(
                "background_task_manager_shutdown_failed conversation_id={}",
                conversation_id,
            )


# ---------------------------------------------------------------------------
# Reconstructed history normalization
# ---------------------------------------------------------------------------


def _content_is_empty(content: Any) -> bool:
    if content is None:
        return True
    if isinstance(content, str):
        return not content.strip()
    if isinstance(content, list):
        for block in content:
            if not isinstance(block, dict) or block.get("type") != "text":
                return False
            if str(block.get("text", "")).strip():
                return False
        return True
    return False


def _as_blocks(content: Any) -> list[Any]:
    if isinstance(content, list):
        return list(content)
    return [{"type": "text", "text": str(content)}]


def _merge_contents(first: Any, second: Any) -> Any:
    if isinstance(first, str) and isinstance(second, str):
        return f"{first}\n\n{second}"
    return [*_as_blocks(first), *_as_blocks(second)]


def normalize_reconstructed_messages(
    messages: list[dict[str, Any]],
    *,
    context_summary: str | None = None,
) -> list[dict[str, Any]]:
    """Make DB-reconstructed history a valid alternating message chain.

    - The compressed earlier-sessions summary becomes user-role context.
    - Empty messages are dropped.
    - Consecutive same-role messages (e.g. a failed turn that persisted a user
      row without an assistant reply) are merged.
    - The chain always starts with a user message.
    """
    candidates: list[dict[str, Any]] = []
    summary = (context_summary or "").strip()
    if summary:
        candidates.append(
            {"role": "user", "content": EARLIER_SESSIONS_HEADER + summary}
        )
    candidates.extend(
        message
        for message in messages
        if message.get("role") in ("user", "assistant")
        and not _content_is_empty(message.get("content"))
    )

    normalized: list[dict[str, Any]] = []
    for message in candidates:
        if normalized and normalized[-1]["role"] == message["role"]:
            previous = normalized[-1]
            normalized[-1] = {
                **previous,
                "content": _merge_contents(previous["content"], message["content"]),
            }
            continue
        normalized.append(dict(message))

    if normalized and normalized[0]["role"] != "user":
        normalized.insert(
            0, {"role": "user", "content": RESUMED_CONVERSATION_PLACEHOLDER}
        )
    return normalized
