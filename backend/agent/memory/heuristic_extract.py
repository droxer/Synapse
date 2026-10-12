"""Heuristic extraction of memory facts from free text (no LLM).

Extraction is deliberately strict: facts are later injected into the system
prompt, so only short first-person statements authored by the user are
considered. Quoted lines (``>``), fenced code blocks, and long messages
(likely pasted documents or logs) are ignored.
"""

from __future__ import annotations

import re

from agent.memory.facts import FactCandidate

# Messages longer than this are most likely pasted content, not the user
# describing themselves.
MAX_HEURISTIC_MESSAGE_CHARS = 2000
# Longer values are almost never a genuine preference and are rejected.
MAX_HEURISTIC_VALUE_CHARS = 200

_TIMEZONE_ASSERTION_RE = re.compile(
    r"^(?:my\s+)?time\s*zone\s+is\s+(?P<value>.+)$",
    re.IGNORECASE,
)
_PREFERENCE_RE = re.compile(r"^i\s+prefer\s+(?P<value>.+)$", re.IGNORECASE)
_LANGUAGE_RE = re.compile(r"^my\s+language\s+is\s+(?P<value>.+)$", re.IGNORECASE)
_FENCED_BLOCK_RE = re.compile(r"```.*?(?:```|\Z)", re.DOTALL)
_SENTENCE_SPLIT_RE = re.compile(r"(?<=[.!?。！？])\s+|\n+")
_TRAILING_PUNCTUATION = " \t.!。！,;:"


def _own_text(text: str) -> str:
    """Drop fenced code blocks and quoted lines, keeping the user's own prose."""
    without_fences = _FENCED_BLOCK_RE.sub("\n", text)
    lines = [
        line
        for line in without_fences.splitlines()
        if not line.lstrip().startswith(">")
    ]
    return "\n".join(lines).strip()


def _sentences(text: str) -> tuple[str, ...]:
    return tuple(
        part.strip() for part in _SENTENCE_SPLIT_RE.split(text) if part.strip()
    )


def _clean_value(raw: str) -> str | None:
    value = raw.strip().rstrip(_TRAILING_PUNCTUATION).strip()
    if not value or "?" in value or len(value) > MAX_HEURISTIC_VALUE_CHARS:
        return None
    return value


def _sentence_candidate(
    sentence: str,
    pattern: re.Pattern[str],
    *,
    namespace: str,
    key: str,
    confidence: float,
) -> FactCandidate | None:
    match = pattern.match(sentence)
    if not match:
        return None
    value = _clean_value(match.group("value"))
    if value is None:
        return None
    return FactCandidate(
        namespace=namespace,
        key=key,
        value=value,
        confidence=confidence,
        evidence_snippet=sentence[:500],
    )


def heuristic_fact_source(source: str) -> str:
    """Tag a fact source as heuristically extracted (column is 32 chars)."""
    return f"heuristic:{source}"[:32]


def extract_fact_candidates(text: str) -> tuple[FactCandidate, ...]:
    """Extract strict memory fact candidates from user-style text."""
    normalized = text.strip()
    if not normalized or len(normalized) > MAX_HEURISTIC_MESSAGE_CHARS:
        return ()

    own_text = _own_text(normalized)
    if not own_text:
        return ()

    candidates: list[FactCandidate] = []

    # Timezone must be the entire message ("my timezone is UTC+8").
    timezone_match = _TIMEZONE_ASSERTION_RE.match(own_text)
    if timezone_match:
        raw_value = timezone_match.group("value").strip()
        value = None if "?" in raw_value else _clean_value(raw_value)
        if value:
            candidates.append(
                FactCandidate(
                    namespace="profile",
                    key="profile.timezone",
                    value=value,
                    confidence=0.9,
                    evidence_snippet=own_text[:500],
                )
            )

    preference: FactCandidate | None = None
    language: FactCandidate | None = None
    for sentence in _sentences(own_text):
        if preference is None:
            preference = _sentence_candidate(
                sentence,
                _PREFERENCE_RE,
                namespace="preferences",
                key="preferences.general",
                confidence=0.88,
            )
        if language is None:
            language = _sentence_candidate(
                sentence,
                _LANGUAGE_RE,
                namespace="preferences",
                key="preferences.language",
                confidence=0.92,
            )

    return tuple(
        candidate
        for candidate in (*candidates, preference, language)
        if candidate is not None
    )
