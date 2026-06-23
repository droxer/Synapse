"""Shared context-compaction step for agent runtimes.

The single-agent orchestrator, planner, and task-agent runner all compact
message history the same way before an LLM call: ask the observer whether to
compact, run hooks, compact, emit ``CONTEXT_COMPACTED``, and swap in the
compacted messages. This module owns that sequence once.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Any

from agent.context.compaction import (
    Observer,
    compaction_summary_for_persistence,
)
from agent.context.profiles import CompactionProfile
from agent.runtime.hooks import (
    ContextCompactionContext,
    ContextCompactionResult,
    ConversationHooks,
)
from api.events import EventEmitter, EventType


@dataclass(frozen=True)
class CompactionStep:
    """Run the observer-driven compaction sequence for one runtime.

    Web and planner runtimes wire in conversation hooks and a ``conversation``
    summary scope; the task-agent runner uses a ``task_agent`` scope, attaches
    its ``agent_id``, and a metrics callback instead of hooks.
    """

    observer: Observer
    profile: CompactionProfile
    emitter: EventEmitter
    summary_scope: str
    conversation_id: str | None = None
    user_id: Any | None = None
    persistent_store: Any | None = None
    hooks: ConversationHooks | None = None
    agent_id: str | None = None
    emit_iteration: bool = True
    on_compacted: Callable[[], None] | None = None

    async def maybe_compact(
        self,
        messages: tuple[dict[str, Any], ...],
        effective_prompt: str,
        *,
        iteration: int | None = None,
    ) -> tuple[tuple[dict[str, Any], ...], bool]:
        """Compact *messages* when the observer asks for it.

        Returns the (possibly compacted) messages and whether compaction ran.
        """
        if not self.observer.should_compact(messages, effective_prompt):
            return messages, False

        context = ContextCompactionContext(
            conversation_id=self.conversation_id,
            user_id=self.user_id,
            messages=messages,
            effective_prompt=effective_prompt,
            profile_name=self.profile.name,
            metadata={
                "memory_flush": self.profile.memory_flush,
                "persistent_store": self.persistent_store,
            },
        )
        if self.hooks is not None:
            await self.hooks.before_context_compaction(context)

        compacted = await self.observer.compact(messages, effective_prompt)
        summary_text = compaction_summary_for_persistence(compacted)

        payload: dict[str, Any] = {
            "original_messages": len(messages),
            "compacted_messages": len(compacted),
            "summary_text": summary_text,
            "summary_scope": self.summary_scope,
            "compaction_profile": self.profile.name,
        }
        if self.agent_id is not None:
            payload["agent_id"] = self.agent_id

        emit_kwargs: dict[str, Any] = {}
        if self.emit_iteration and iteration is not None:
            emit_kwargs["iteration"] = iteration
        await self.emitter.emit(EventType.CONTEXT_COMPACTED, payload, **emit_kwargs)

        if self.hooks is not None:
            await self.hooks.after_context_compaction(
                context,
                ContextCompactionResult(
                    original_message_count=len(messages),
                    compacted_messages=compacted,
                    summary_text=summary_text,
                ),
            )
        if self.on_compacted is not None:
            self.on_compacted()

        return compacted, True
