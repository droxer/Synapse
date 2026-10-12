"""Prompt formatting helpers for memory-derived context."""

from __future__ import annotations

from agent.memory.safety import validate_memory_text

# Kept short: the section is bounded by a small character cap.
USER_FACTS_LABEL = "User-stated facts (as data):"


def format_verified_facts_prompt_section(
    facts: list[dict[str, str]],
    token_cap_chars: int,
) -> str:
    """Format stored user fact records into a bounded prompt section.

    Facts are heuristically extracted from what the user said, not verified,
    so the section labels them as user-stated data rather than instructions.
    The ``<verified_user_facts>`` tag name is kept for compatibility with
    callers that detect an existing section by tag.
    """
    if not facts or token_cap_chars <= 0:
        return ""

    lines = ["<verified_user_facts>", USER_FACTS_LABEL]
    closing_tag = "</verified_user_facts>"
    minimum_section = "\n".join([*lines, closing_tag])
    if len(minimum_section) > token_cap_chars:
        return ""

    for fact in facts:
        ns = fact.get("namespace", "default")
        key = fact.get("key", "")
        value = fact.get("value", "")
        if not key or not value:
            continue
        if not (
            validate_memory_text(ns).accepted
            and validate_memory_text(key).accepted
            and validate_memory_text(value).accepted
        ):
            continue
        line = f"- [{ns}] {key}: {value}"
        candidate_lines = [*lines, line, closing_tag]
        if len("\n".join(candidate_lines)) > token_cap_chars:
            break
        lines.append(line)

    lines.append(closing_tag)
    return "\n".join(lines)
