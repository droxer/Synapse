"""Tests for ``repair_message_chain`` (provider-valid message chains)."""

from __future__ import annotations

from typing import Any

from agent.runtime.message_chain import collect_message_chain_warnings
from agent.runtime.message_repair import repair_message_chain


def _tool_use(tool_id: str, name: str = "web_search") -> dict[str, Any]:
    return {"type": "tool_use", "id": tool_id, "name": name, "input": {}}


def _tool_result(tool_id: str, text: str = "ok") -> dict[str, Any]:
    return {"type": "tool_result", "tool_use_id": tool_id, "content": text}


def _result_ids(message: dict[str, Any]) -> list[str]:
    return [
        b["tool_use_id"]
        for b in message["content"]
        if isinstance(b, dict) and b.get("type") == "tool_result"
    ]


def test_valid_chain_is_unchanged_and_has_no_warnings() -> None:
    messages = (
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": [_tool_use("t1")]},
        {"role": "user", "content": [_tool_result("t1")]},
        {"role": "assistant", "content": [{"type": "text", "text": "done"}]},
    )

    repaired, warnings = repair_message_chain(messages)

    assert repaired == messages
    assert warnings == []


def test_trailing_tool_use_gets_synthetic_error_results() -> None:
    messages = (
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": [_tool_use("t1"), _tool_use("t2")]},
    )

    repaired, warnings = repair_message_chain(messages)

    assert len(repaired) == 3
    assert repaired[-1]["role"] == "user"
    assert _result_ids(repaired[-1]) == ["t1", "t2"]
    assert all(b.get("is_error") is True for b in repaired[-1]["content"])
    assert warnings
    assert collect_message_chain_warnings(repaired) == []


def test_missing_result_is_added_to_existing_user_message_first() -> None:
    messages = (
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": [_tool_use("t1"), _tool_use("t2")]},
        {
            "role": "user",
            "content": [_tool_result("t1"), {"type": "text", "text": "note"}],
        },
    )

    repaired, warnings = repair_message_chain(messages)

    last = repaired[-1]
    assert sorted(_result_ids(last)) == ["t1", "t2"]
    # tool_result blocks must precede any other blocks
    types = [b["type"] for b in last["content"]]
    assert types == ["tool_result", "tool_result", "text"]
    assert warnings
    assert collect_message_chain_warnings(repaired) == []


def test_tool_use_followed_by_plain_user_text_is_merged() -> None:
    messages = (
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": [_tool_use("t1")]},
        {"role": "user", "content": "next question"},
    )

    repaired, _ = repair_message_chain(messages)

    assert len(repaired) == 3
    last = repaired[-1]
    assert _result_ids(last) == ["t1"]
    assert last["content"][-1] == {"type": "text", "text": "next question"}
    assert collect_message_chain_warnings(repaired) == []


def test_tool_use_followed_by_assistant_inserts_results_between() -> None:
    messages = (
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": [_tool_use("t1")]},
        {"role": "assistant", "content": [{"type": "text", "text": "later"}]},
    )

    repaired, _ = repair_message_chain(messages)

    assert [m["role"] for m in repaired] == ["user", "assistant", "user", "assistant"]
    assert _result_ids(repaired[2]) == ["t1"]


def test_orphan_tool_results_are_dropped() -> None:
    messages = (
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": [{"type": "text", "text": "answer"}]},
        {"role": "user", "content": [_tool_result("ghost")]},
        {
            "role": "user",
            "content": [_tool_result("ghost2"), {"type": "text", "text": "keep"}],
        },
    )

    repaired, warnings = repair_message_chain(messages)

    assert repaired == (
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": [{"type": "text", "text": "answer"}]},
        {"role": "user", "content": [{"type": "text", "text": "keep"}]},
    )
    assert len(warnings) == 2


def test_duplicate_tool_results_are_deduplicated() -> None:
    messages = (
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": [_tool_use("t1")]},
        {"role": "user", "content": [_tool_result("t1"), _tool_result("t1", "x")]},
    )

    repaired, warnings = repair_message_chain(messages)

    assert _result_ids(repaired[-1]) == ["t1"]
    assert warnings


def test_empty_assistant_messages_are_dropped() -> None:
    messages = (
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": ""},
        {"role": "assistant", "content": []},
        {"role": "assistant", "content": [{"type": "text", "text": ""}]},
        {"role": "user", "content": "again"},
    )

    repaired, warnings = repair_message_chain(messages)

    assert [m["role"] for m in repaired] == ["user", "user"]
    assert len(warnings) == 3


def test_empty_text_blocks_are_removed_from_assistant_content() -> None:
    messages = (
        {"role": "user", "content": "hi"},
        {
            "role": "assistant",
            "content": [{"type": "text", "text": ""}, _tool_use("t1")],
        },
        {"role": "user", "content": [_tool_result("t1")]},
    )

    repaired, _ = repair_message_chain(messages)

    assert repaired[1]["content"] == [_tool_use("t1")]


def test_empty_user_content_is_replaced_with_placeholder() -> None:
    messages = ({"role": "user", "content": "   "},)

    repaired, warnings = repair_message_chain(messages)

    assert len(repaired) == 1
    assert isinstance(repaired[0]["content"], str)
    assert repaired[0]["content"].strip()
    assert warnings


def test_thinking_only_assistant_message_is_dropped_but_kept_with_tool_use() -> None:
    thinking = {"type": "thinking", "thinking": "hmm", "signature": "sig"}
    messages = (
        {"role": "user", "content": "hi"},
        {"role": "assistant", "content": [thinking]},
        {"role": "user", "content": "go"},
        {"role": "assistant", "content": [thinking, _tool_use("t1")]},
        {"role": "user", "content": [_tool_result("t1")]},
    )

    repaired, _ = repair_message_chain(messages)

    assert [m["role"] for m in repaired] == ["user", "user", "assistant", "user"]
    assert repaired[2]["content"][0] == thinking


def test_repair_does_not_mutate_input() -> None:
    assistant = {"role": "assistant", "content": [_tool_use("t1")]}
    user = {"role": "user", "content": [_tool_result("t1"), _tool_result("zz")]}
    messages = ({"role": "user", "content": "hi"}, assistant, user)

    repair_message_chain(messages)

    assert user["content"] == [_tool_result("t1"), _tool_result("zz")]
    assert assistant["content"] == [_tool_use("t1")]
