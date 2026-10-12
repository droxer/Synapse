"""Regression tests for context-compaction harness defects (group 2)."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest

from agent.context.compaction import (
    Observer,
    _compact_content_block,
    _estimate_tokens,
    _repair_tool_pairing,
    _truncate_tool_result,
    compaction_summary_for_persistence,
)
from agent.context.compaction_step import CompactionStep
from agent.context.profiles import resolve_compaction_profile
from config.settings import Settings


@pytest.fixture(autouse=True)
def _default_weighted_token_strategy(monkeypatch) -> None:
    monkeypatch.setattr(
        "config.settings.get_settings",
        lambda: SimpleNamespace(
            COMPACT_TOKEN_COUNTER="weighted",
            COMPACT_FALLBACK_PREVIEW_CHARS=500,
            COMPACT_FALLBACK_RESULT_CHARS=1000,
            COMPACT_DIALOGUE_FALLBACK_CHARS=12_000,
        ),
    )


def _user(text: str) -> dict[str, Any]:
    return {"role": "user", "content": text}


def _assistant(text: str) -> dict[str, Any]:
    return {"role": "assistant", "content": text}


def _tool_use(call_id: str, name: str = "tool") -> dict[str, Any]:
    return {
        "role": "assistant",
        "content": [{"type": "tool_use", "id": call_id, "name": name, "input": {}}],
    }


def _tool_result(call_id: str, content: Any) -> dict[str, Any]:
    return {
        "role": "user",
        "content": [
            {"type": "tool_result", "tool_use_id": call_id, "content": content},
        ],
    }


def _big_image(size: int = 500_000) -> dict[str, Any]:
    return {
        "type": "image",
        "source": {"type": "base64", "media_type": "image/png", "data": "A" * size},
    }


def _summary_client(text: str = "- summary bullet") -> MagicMock:
    client = MagicMock()
    client.create_message = AsyncMock(return_value=SimpleNamespace(text=text))
    return client


def _assert_valid_image_blocks(messages: tuple[dict[str, Any], ...]) -> None:
    def _walk(blocks: Any) -> None:
        if not isinstance(blocks, list):
            return
        for block in blocks:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "image":
                assert isinstance(block.get("source"), dict), block
            if block.get("type") == "tool_result":
                _walk(block.get("content"))

    for msg in messages:
        _walk(msg.get("content"))


def _assert_tool_pairing(messages: tuple[dict[str, Any], ...]) -> None:
    for idx, msg in enumerate(messages):
        content = msg.get("content")
        if not isinstance(content, list):
            continue
        result_ids = [
            b.get("tool_use_id")
            for b in content
            if isinstance(b, dict) and b.get("type") == "tool_result"
        ]
        if not result_ids:
            continue
        assert idx > 0, "tool_result cannot be the first message"
        prev = messages[idx - 1]
        assert prev.get("role") == "assistant"
        prev_content = prev.get("content")
        assert isinstance(prev_content, list)
        use_ids = {
            b.get("id")
            for b in prev_content
            if isinstance(b, dict) and b.get("type") == "tool_use"
        }
        for rid in result_ids:
            assert rid in use_ids, f"orphan tool_result {rid}"


# ------------------------------------------------------------------
# Defect 1: image placeholders must be valid content blocks
# ------------------------------------------------------------------


class TestImagePlaceholders:
    def test_top_level_image_becomes_text_block(self) -> None:
        result = _compact_content_block(_big_image(10))
        assert result["type"] == "text"
        assert "image omitted" in result["text"].lower()
        assert "source" not in result

    def test_nested_tool_result_image_becomes_text_block(self) -> None:
        block = {
            "type": "tool_result",
            "tool_use_id": "c1",
            "content": [{"type": "text", "text": "ok"}, _big_image(10)],
        }
        result = _truncate_tool_result(block)
        nested = result["content"][1]
        assert nested["type"] == "text"
        assert "screenshot" in nested["text"].lower()

    @pytest.mark.asyncio
    async def test_fallback_path_never_emits_string_image_source(self) -> None:
        client = AsyncMock()
        client.create_message.side_effect = RuntimeError("down")
        obs = Observer(
            max_full_interactions=1,
            token_budget=400,
            claude_client=client,
            summary_model="lite",
        )
        msgs = (
            _user("task"),
            {
                "role": "user",
                "content": [{"type": "text", "text": "look"}, _big_image(10)],
            },
            _tool_use("c1"),
            _tool_result("c1", [{"type": "text", "text": "x" * 800}, _big_image(10)]),
            _tool_use("c2"),
            _tool_result("c2", "done"),
        )
        out = await obs.compact(msgs)
        _assert_valid_image_blocks(out)


# ------------------------------------------------------------------
# Defect 2: token estimate must not count base64 payloads as text
# ------------------------------------------------------------------


class TestTokenEstimateMedia:
    def test_image_counts_as_fixed_cost(self) -> None:
        msgs = (
            _user("hi"),
            _tool_use("c1"),
            _tool_result("c1", [_big_image()]),
        )
        tokens = _estimate_tokens(msgs)
        assert 1000 < tokens < 5000

    def test_top_level_document_counts_as_fixed_cost(self) -> None:
        doc = {
            "type": "document",
            "source": {
                "type": "base64",
                "media_type": "application/pdf",
                "data": "B" * 400_000,
            },
        }
        tokens = _estimate_tokens(({"role": "user", "content": [doc]},))
        assert tokens < 5000

    def test_screenshot_does_not_trigger_compaction(self) -> None:
        obs = Observer(token_budget=20_000)
        msgs = (_user("hi"), _tool_use("c1"), _tool_result("c1", [_big_image()]))
        assert obs.should_compact(msgs) is False

    def test_overhead_tokens_count_against_budget(self) -> None:
        obs = Observer(token_budget=1000)
        msgs = (_user("x" * 2000),)
        assert obs.should_compact(msgs) is False
        assert obs.should_compact(msgs, overhead_tokens=800) is True
        assert _estimate_tokens(msgs, extra_tokens=800) == _estimate_tokens(msgs) + 800


# ------------------------------------------------------------------
# Defect 3: hot-tier split must never orphan a tool_result
# ------------------------------------------------------------------


class TestToolPairing:
    @pytest.mark.asyncio
    async def test_hot_overflow_does_not_start_hot_tier_with_tool_result(
        self,
    ) -> None:
        obs = Observer(
            max_full_interactions=2,
            token_budget=600,
            claude_client=_summary_client(),
            summary_model="lite",
        )
        msgs = (
            _user("task"),
            _assistant("thinking " * 300),
            _tool_use("c1"),
            _tool_result("c1", "r1 " * 200),
            _assistant("interim"),
            _tool_use("c2"),
            _tool_result("c2", "r2"),
        )
        out = await obs.compact(msgs)
        _assert_tool_pairing(out)

    def test_repair_converts_orphan_tool_result_to_text(self) -> None:
        msgs = (
            _user("task"),
            _assistant("## Previous work\n- stuff"),
            _tool_result("gone", "orphaned output"),
            _tool_use("c2"),
            _tool_result("c2", "fine"),
        )
        repaired = _repair_tool_pairing(msgs)
        _assert_tool_pairing(repaired)
        assert "orphaned output" in str(repaired[2]["content"])
        assert repaired[3:] == msgs[3:]

    def test_repair_converts_orphan_tool_use_to_text(self) -> None:
        msgs = (
            _user("task"),
            _tool_use("c1", "search"),
            _assistant("no result followed"),
        )
        repaired = _repair_tool_pairing(msgs)
        blocks = repaired[1]["content"]
        assert all(b.get("type") != "tool_use" for b in blocks)
        assert "search" in str(blocks)

    def test_repair_keeps_trailing_pending_tool_use(self) -> None:
        msgs = (_user("task"), _tool_use("c1"))
        assert _repair_tool_pairing(msgs) == msgs

    def test_repair_returns_same_tuple_when_valid(self) -> None:
        msgs = (_user("task"), _tool_use("c1"), _tool_result("c1", "ok"))
        assert _repair_tool_pairing(msgs) == msgs


# ------------------------------------------------------------------
# Defect 4: only tool-derived screenshot text is replaced
# ------------------------------------------------------------------


class TestScreenshotText:
    def test_user_text_mentioning_screenshot_is_preserved(self) -> None:
        block = {"type": "text", "text": "Please take a screenshot of the login page"}
        assert _compact_content_block(block) is block

    def test_tool_message_screenshot_text_is_replaced(self) -> None:
        block = {"type": "text", "text": "Screenshot captured: 1280x800"}
        result = _compact_content_block(block, from_tool_message=True)
        assert result["text"] == "[screenshot captured]"

    @pytest.mark.asyncio
    async def test_warm_user_request_with_screenshot_word_survives(self) -> None:
        obs = Observer(max_full_interactions=1, token_budget=500)
        request = "Take a screenshot of example.com and describe the header"
        msgs = (
            _user("earlier task"),
            {"role": "user", "content": [{"type": "text", "text": request}]},
            _tool_use("c1"),
            _tool_result("c1", "x" * 3000),
            _tool_use("c2"),
            _tool_result("c2", "done"),
        )
        out = await obs.compact(msgs)
        assert request in str(out)


# ------------------------------------------------------------------
# Defect 5: current-turn request and prior summaries are preserved
# ------------------------------------------------------------------


class TestCurrentTurnAnchor:
    @pytest.mark.asyncio
    async def test_current_user_request_kept_in_full(self) -> None:
        client = _summary_client()
        obs = Observer(
            max_full_interactions=1,
            token_budget=2500,
            claude_client=client,
            summary_model="lite",
        )
        current = "CURRENT REQUEST: " + "detail " * 300
        msgs = (
            _assistant("## Earlier sessions\n- old stuff"),
            _user("old question"),
            _assistant("old answer"),
            _user(current),
            _tool_use("c1"),
            _tool_result("c1", "a" * 3000),
            _tool_use("c2"),
            _tool_result("c2", "b" * 3000),
            _tool_use("c3"),
            _tool_result("c3", "done"),
        )
        out = await obs.compact(msgs)
        assert any(m.get("content") == current for m in out)
        _assert_tool_pairing(out)

    @pytest.mark.asyncio
    async def test_existing_summary_passed_untruncated_to_resummarise(self) -> None:
        client = _summary_client()
        obs = Observer(
            max_full_interactions=1,
            token_budget=800,
            claude_client=client,
            summary_model="lite",
        )
        prior_body = "- " + "important finding " * 100
        msgs = (
            _user("task"),
            _assistant(f"## Previous work\n{prior_body}"),
            _tool_use("c1"),
            _tool_result("c1", "a" * 3000),
            _tool_use("c2"),
            _tool_result("c2", "done"),
        )
        await obs.compact(msgs)
        sent = client.create_message.await_args.kwargs["messages"][0]["content"]
        assert prior_body in sent


# ------------------------------------------------------------------
# Defect 8: persistence only returns summaries produced by this compaction
# ------------------------------------------------------------------


class TestSummaryForPersistence:
    def test_pre_existing_summary_is_not_returned(self) -> None:
        old = _assistant("## Previous work\n- old")
        original = (_user("task"), old, _tool_use("c1"), _tool_result("c1", "x"))
        compacted = (_user("task"), old, _tool_use("c1"), _tool_result("c1", "x"))
        assert compaction_summary_for_persistence(compacted, original) is None

    def test_new_summary_is_returned(self) -> None:
        old = _assistant("## Previous work\n- old")
        original = (_user("task"), old, _tool_use("c1"), _tool_result("c1", "x"))
        compacted = (_user("task"), _assistant("## Previous work\n- new"))
        assert (
            compaction_summary_for_persistence(compacted, original)
            == "## Previous work\n- new"
        )

    @pytest.mark.asyncio
    async def test_compaction_step_skips_stale_summary(self) -> None:
        old = _assistant("## Previous work\n- old")
        messages = (_user("task"), old, _tool_use("c1"), _tool_result("c1", "x"))
        observer = MagicMock()
        observer.should_compact.return_value = True
        observer.compact = AsyncMock(return_value=messages)
        emitter = MagicMock()
        emitter.emit = AsyncMock()
        step = CompactionStep(
            observer=observer,
            profile=SimpleNamespace(name="web_conversation", memory_flush=False),
            emitter=emitter,
            summary_scope="conversation",
        )
        await step.maybe_compact(messages, "")
        payload = emitter.emit.await_args.args[1]
        assert payload["summary_text"] is None


# ------------------------------------------------------------------
# Defect 10: summary model fallback for non-Anthropic endpoints
# ------------------------------------------------------------------


class TestSummaryModelFallback:
    def _settings(self, **overrides: Any) -> Settings:
        values: dict[str, Any] = {
            "ANTHROPIC_API_KEY": "k",
            "TAVILY_API_KEY": "t",
            "TASK_MODEL": "gpt-main",
        }
        values.update(overrides)
        return Settings(_env_file=None, **values)

    def test_non_anthropic_base_url_without_lite_model_uses_task_model(
        self, monkeypatch
    ) -> None:
        monkeypatch.delenv("LITE_MODEL", raising=False)
        settings = self._settings(ANTHROPIC_BASE_URL="https://openrouter.ai/api/v1")
        profile = resolve_compaction_profile(settings, "web_conversation")
        assert profile.summary_model == "gpt-main"

    def test_explicit_lite_model_is_respected(self, monkeypatch) -> None:
        monkeypatch.delenv("LITE_MODEL", raising=False)
        settings = self._settings(
            ANTHROPIC_BASE_URL="https://openrouter.ai/api/v1",
            LITE_MODEL="gpt-mini",
        )
        profile = resolve_compaction_profile(settings, "web_conversation")
        assert profile.summary_model == ""

    def test_anthropic_base_url_unchanged(self, monkeypatch) -> None:
        monkeypatch.delenv("LITE_MODEL", raising=False)
        settings = self._settings()
        profile = resolve_compaction_profile(settings, "web_conversation")
        assert profile.summary_model == ""
