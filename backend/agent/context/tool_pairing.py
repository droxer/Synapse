"""Tool-use / tool-result pairing helpers for compacted message history.

The Messages API rejects a request (HTTP 400) when a ``tool_result`` block
does not reference a ``tool_use`` in the immediately preceding assistant
message, or when a non-final ``tool_use`` is not answered by the next user
message. Compaction moves message boundaries around, so every compaction
output is run through :func:`repair_tool_pairing`.

All helpers are pure — input messages are never mutated.
"""

from __future__ import annotations

import json
from typing import Any

_REPAIRED_RESULT_CHARS = 1000
_REPAIRED_INPUT_CHARS = 200


def _blocks(message: dict[str, Any]) -> list[Any]:
    content = message.get("content")
    return content if isinstance(content, list) else []


def _is_block(block: Any, block_type: str) -> bool:
    return isinstance(block, dict) and block.get("type") == block_type


def has_tool_results(message: dict[str, Any]) -> bool:
    """Return whether *message* contains ``tool_result`` blocks."""
    return any(_is_block(block, "tool_result") for block in _blocks(message))


def _tool_use_ids(message: dict[str, Any]) -> frozenset[str]:
    if message.get("role") != "assistant":
        return frozenset()
    return frozenset(
        str(block.get("id", ""))
        for block in _blocks(message)
        if _is_block(block, "tool_use")
    )


def _tool_result_ids(message: dict[str, Any]) -> frozenset[str]:
    if message.get("role") != "user":
        return frozenset()
    return frozenset(
        str(block.get("tool_use_id", ""))
        for block in _blocks(message)
        if _is_block(block, "tool_result")
    )


def _result_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        return " ".join(
            str(block.get("text", "")) if isinstance(block, dict) else str(block)
            for block in content
        )
    return str(content)


def _orphan_result_as_text(block: dict[str, Any]) -> dict[str, Any]:
    text = _result_text(block.get("content", "")).strip()
    if len(text) > _REPAIRED_RESULT_CHARS:
        text = f"{text[:_REPAIRED_RESULT_CHARS]}...[HISTORY_TRUNCATED]"
    label = "[earlier tool error]" if block.get("is_error") else "[earlier tool result]"
    return {"type": "text", "text": f"{label} {text}".strip()}


def _orphan_use_as_text(block: dict[str, Any]) -> dict[str, Any]:
    tool_input = json.dumps(block.get("input", {}), default=str)[:_REPAIRED_INPUT_CHARS]
    return {
        "type": "text",
        "text": f"[called tool {block.get('name', '?')}({tool_input})]",
    }


def repair_tool_pairing(
    messages: tuple[dict[str, Any], ...],
) -> tuple[dict[str, Any], ...]:
    """Return *messages* with unpaired tool blocks converted to plain text.

    - A ``tool_result`` is kept only when the immediately preceding message
      is an assistant message containing the matching ``tool_use``.
    - A ``tool_use`` is kept only when the next message is a user message
      with the matching ``tool_result`` (or it sits in the final message,
      i.e. a call whose result has not been produced yet).

    Unpaired blocks are rewritten as text so their information survives.
    Returns the original tuple unchanged when nothing needed repair.
    """
    use_ids = [_tool_use_ids(msg) for msg in messages]
    result_ids = [_tool_result_ids(msg) for msg in messages]
    last = len(messages) - 1

    repaired: list[dict[str, Any]] = []
    changed = False
    for idx, msg in enumerate(messages):
        blocks = _blocks(msg)
        if not blocks:
            repaired.append(msg)
            continue
        prev_uses = use_ids[idx - 1] if idx > 0 else frozenset()
        next_results = result_ids[idx + 1] if idx < last else frozenset()
        new_blocks: list[Any] = []
        msg_changed = False
        for block in blocks:
            if (
                _is_block(block, "tool_result")
                and str(block.get("tool_use_id", "")) not in prev_uses
            ):
                new_blocks.append(_orphan_result_as_text(block))
                msg_changed = True
            elif (
                _is_block(block, "tool_use")
                and idx < last
                and str(block.get("id", "")) not in next_results
            ):
                new_blocks.append(_orphan_use_as_text(block))
                msg_changed = True
            else:
                new_blocks.append(block)
        if msg_changed:
            changed = True
            repaired.append({**msg, "content": new_blocks})
        else:
            repaired.append(msg)
    return tuple(repaired) if changed else messages


def safe_hot_split(messages: list[dict[str, Any]], split: int) -> int:
    """Move *split* back so ``messages[split:]`` never starts with a tool_result.

    Starting the verbatim (hot) tier on a tool_result whose tool_use was
    summarised away would orphan it; walking back includes the matching
    assistant ``tool_use`` message in the hot tier instead.
    """
    split = max(0, min(split, len(messages)))
    while 0 < split < len(messages) and has_tool_results(messages[split]):
        split -= 1
    return split


def is_real_user_message(message: dict[str, Any]) -> bool:
    """Return whether *message* is human-authored user input (not tool output)."""
    if message.get("role") != "user" or has_tool_results(message):
        return False
    content = message.get("content")
    if isinstance(content, str):
        return bool(content.strip())
    return any(
        _is_block(block, "text") and str(block.get("text", "")).strip()
        for block in _blocks(message)
    )


def current_request_in(
    messages: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Return the latest real user message in *messages*, if any."""
    for msg in reversed(messages):
        if is_real_user_message(msg):
            return msg
    return None
