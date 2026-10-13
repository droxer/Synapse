"""Heuristic memory flush before context compaction (OpenClaw-style)."""

from __future__ import annotations

import hashlib
from typing import Any

from loguru import logger

from agent.memory.facts import validate_fact_candidate
from agent.memory.heuristic_extract import (
    extract_fact_candidates,
    heuristic_fact_source,
)
from agent.memory.store import PersistentMemoryStore
from agent.config import get_settings


def _user_text_for_fact_flush(message: dict[str, Any]) -> str:
    """Return only human-authored user text, excluding tool results."""
    content = message.get("content", "")
    if isinstance(content, str):
        return content.strip()
    if not isinstance(content, list):
        return str(content).strip()

    parts: list[str] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "text":
            text = str(block.get("text", "")).strip()
            if text:
                parts.append(text)
    return " ".join(parts).strip()


def _message_digest(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


async def flush_heuristic_facts_from_messages(
    store: PersistentMemoryStore,
    messages: tuple[dict[str, Any], ...],
    *,
    source: str = "compaction",
) -> None:
    """Persist high-confidence heuristic facts found in user message text.

    Each distinct user text is scanned at most once per store, so repeated
    compactions of a long conversation do not re-process the same messages.
    """
    if not store.is_available:
        return

    settings = get_settings()
    threshold = settings.MEMORY_FACT_CONFIDENCE_THRESHOLD

    for msg in messages:
        if msg.get("role") != "user":
            continue
        text = _user_text_for_fact_flush(msg)
        if not text or not store.claim_flush_digest(_message_digest(text)):
            continue
        for candidate in extract_fact_candidates(text):
            verdict = validate_fact_candidate(candidate, threshold=threshold)
            if not verdict.accepted:
                continue
            try:
                await store.upsert_fact(
                    namespace=candidate.namespace,
                    key=candidate.key,
                    value=candidate.value,
                    confidence=candidate.confidence,
                    source=heuristic_fact_source(source),
                    source_chat_id="",
                    evidence_snippet=candidate.evidence_snippet,
                )
            except Exception:
                logger.opt(exception=True).warning(
                    "compaction_memory_flush_upsert_failed key={}",
                    candidate.key,
                )
