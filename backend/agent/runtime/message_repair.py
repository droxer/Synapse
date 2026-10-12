"""Repair Anthropic-style message chains so providers accept them.

The provider rejects a request (HTTP 400) when:

* an assistant ``tool_use`` block is not answered by a ``tool_result`` with the
  same id in the immediately following user message,
* a ``tool_result`` references an id that the preceding assistant message did
  not issue,
* a message (other than an optional final assistant turn) has empty content,
  or a ``text`` block is empty.

:func:`repair_message_chain` is a pure function that rewrites a message
sequence into a provider-valid one and reports what it changed. It never
mutates its input.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

SYNTHETIC_TOOL_RESULT_TEXT = (
    "Tool call did not complete: no result was recorded for this call."
)
EMPTY_USER_PLACEHOLDER = "(empty message)"

_THINKING_BLOCK_TYPES = frozenset({"thinking", "redacted_thinking"})


def synthetic_tool_result(tool_use_id: str, reason: str) -> dict[str, Any]:
    """Build an ``is_error`` tool_result block for an unanswered tool_use."""
    return {
        "type": "tool_result",
        "tool_use_id": tool_use_id,
        "content": [{"type": "text", "text": reason}],
        "is_error": True,
    }


def _is_block(block: Any, block_type: str) -> bool:
    return isinstance(block, dict) and block.get("type") == block_type


def _is_empty_text_block(block: Any) -> bool:
    if not _is_block(block, "text"):
        return False
    text = block.get("text")
    return not isinstance(text, str) or not text.strip()


def _tool_use_ids(content: Any) -> list[str]:
    if not isinstance(content, list):
        return []
    return [
        str(block["id"])
        for block in content
        if _is_block(block, "tool_use") and block.get("id")
    ]


def _clean_assistant(
    idx: int,
    message: dict[str, Any],
    warnings: list[str],
) -> dict[str, Any] | None:
    """Return the assistant message without empty parts, or None to drop it."""
    content = message.get("content")
    if isinstance(content, str):
        if content.strip():
            return message
        warnings.append(f"message[{idx}]: dropped assistant message with empty text")
        return None
    if not isinstance(content, list):
        warnings.append(f"message[{idx}]: dropped assistant message without content")
        return None

    kept = [block for block in content if not _is_empty_text_block(block)]
    has_substance = any(
        not (isinstance(block, dict) and block.get("type") in _THINKING_BLOCK_TYPES)
        for block in kept
    )
    if not has_substance:
        warnings.append(f"message[{idx}]: dropped assistant message with no content")
        return None
    if len(kept) == len(content):
        return message
    return {**message, "content": kept}


def _clean_user(
    idx: int,
    message: dict[str, Any],
    pending_ids: list[str],
    warnings: list[str],
) -> dict[str, Any] | None:
    """Resolve pending tool_use ids against a user message.

    Returns the repaired message, or None when it ends up empty and carried
    nothing but orphan tool results.
    """
    content = message.get("content")
    if isinstance(content, str):
        other_blocks: list[Any] = (
            [{"type": "text", "text": content}] if content.strip() else []
        )
        results: list[dict[str, Any]] = []
        changed = bool(pending_ids)
        had_tool_results = False
    elif isinstance(content, list):
        pending = set(pending_ids)
        seen: set[str] = set()
        results = []
        other_blocks = []
        changed = False
        had_tool_results = False
        for block in content:
            if _is_block(block, "tool_result"):
                had_tool_results = True
                tool_id = str(block.get("tool_use_id") or "")
                if tool_id not in pending:
                    warnings.append(
                        f"message[{idx}]: dropped orphan tool_result id={tool_id!r}"
                    )
                    changed = True
                    continue
                if tool_id in seen:
                    warnings.append(
                        f"message[{idx}]: dropped duplicate tool_result id={tool_id!r}"
                    )
                    changed = True
                    continue
                seen.add(tool_id)
                results.append(block)
            elif _is_empty_text_block(block):
                changed = True
            else:
                other_blocks.append(block)
        # tool_result blocks must precede any other user content.
        if other_blocks and results and content[: len(results)] != results:
            changed = True
    else:
        other_blocks, results, changed, had_tool_results = [], [], True, False

    answered = {str(block.get("tool_use_id")) for block in results}
    missing = [tool_id for tool_id in pending_ids if tool_id not in answered]
    if missing:
        warnings.append(
            f"message[{idx}]: added synthetic tool_result for missing id(s) {missing}"
        )
        results = [
            *results,
            *(synthetic_tool_result(t, SYNTHETIC_TOOL_RESULT_TEXT) for t in missing),
        ]
        changed = True

    new_content = [*results, *other_blocks]
    if not new_content:
        if had_tool_results:
            return None
        warnings.append(f"message[{idx}]: replaced empty user content")
        return {**message, "content": EMPTY_USER_PLACEHOLDER}
    if not changed:
        return message
    return {**message, "content": new_content}


def repair_message_chain(
    messages: Sequence[dict[str, Any]],
) -> tuple[tuple[dict[str, Any], ...], list[str]]:
    """Return ``(repaired_messages, warnings)`` for a provider-valid chain.

    Guarantees:

    * every assistant ``tool_use`` is followed by a user message that carries a
      ``tool_result`` for each id (synthetic ``is_error`` results are inserted
      for missing ids, placed before any other user content);
    * ``tool_result`` blocks without a matching ``tool_use`` in the preceding
      assistant message are dropped (and the message, if nothing remains);
    * assistant messages with empty content are dropped, empty text blocks
      are removed, and empty user content is replaced with a placeholder.
    """
    warnings: list[str] = []
    repaired: list[dict[str, Any]] = []
    pending_ids: list[str] = []

    for idx, message in enumerate(messages):
        role = message.get("role")
        if role == "assistant":
            cleaned = _clean_assistant(idx, message, warnings)
            if cleaned is None:
                continue
            if pending_ids:
                warnings.append(
                    f"message[{idx}]: inserted synthetic tool_result message "
                    f"for id(s) {pending_ids}"
                )
                repaired.append(_synthetic_results_message(pending_ids))
            repaired.append(cleaned)
            pending_ids = _tool_use_ids(cleaned.get("content"))
            continue

        if role == "user":
            cleaned = _clean_user(idx, message, pending_ids, warnings)
            pending_ids = []
            if cleaned is not None:
                repaired.append(cleaned)
            continue

        repaired.append(message)

    if pending_ids:
        warnings.append(
            f"end_of_chain: appended synthetic tool_result for id(s) {pending_ids}"
        )
        repaired.append(_synthetic_results_message(pending_ids))

    return tuple(repaired), warnings


def _synthetic_results_message(tool_ids: Sequence[str]) -> dict[str, Any]:
    return {
        "role": "user",
        "content": [
            synthetic_tool_result(tool_id, SYNTHETIC_TOOL_RESULT_TEXT)
            for tool_id in tool_ids
        ],
    }
