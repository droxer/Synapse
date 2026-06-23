"""Single-agent ReAct loop orchestrator."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, replace
from typing import Any

from loguru import logger

from agent.llm.client import (
    AnthropicClient,
    SystemPrompt,
    format_llm_failure,
    render_system_prompt,
)
from agent.runtime.prompting import PromptAssembly
from agent.context.profiles import CompactionProfile, resolve_compaction_profile
from agent.memory.store import PersistentMemoryStore
from agent.runtime.hooks import (
    ConversationHooks,
    NoopConversationHooks,
)
from agent.runtime.helpers import (
    apply_response_to_state,
    finalize_conversation_turn,
    find_last_user_message_index,
    get_last_user_message_text,
    process_tool_calls,
)
from agent.runtime.message_chain import (
    collect_message_chain_warnings,
    tool_calls_fingerprint,
)
from agent.context.compaction import Observer
from agent.context.compaction_step import CompactionStep
from agent.runtime.skill_activation import SkillActivation, SkillActivationController
from agent.runtime.turn_attachments import (
    build_user_message_content,
    upload_attachments_to_sandbox,
)
from agent.skills.loader import SkillRegistry
from agent.tools.executor import ToolExecutor
from agent.tools.registry import ToolRegistry
from api.events import EventEmitter, EventType
from api.models import serialize_attachment_metadata
from config.settings import get_settings


@dataclass(frozen=True)
class AgentState:
    """Immutable state of an agent execution loop.

    All mutation methods return a new AgentState instance,
    leaving the original unchanged.
    """

    messages: tuple[dict[str, Any], ...] = ()
    iteration: int = 0
    completed: bool = False
    error: str | None = None

    def add_message(self, message: dict[str, Any]) -> AgentState:
        """Return new state with message appended."""
        return replace(self, messages=(*self.messages, message))

    def increment_iteration(self) -> AgentState:
        """Return new state with iteration incremented by one."""
        return replace(self, iteration=self.iteration + 1)

    def mark_completed(self, summary: str | None = None) -> AgentState:
        """Return new state marked as completed, optionally appending a summary."""
        messages = self.messages
        if summary is not None:
            final_msg: dict[str, Any] = {"role": "assistant", "content": summary}
            messages = (*messages, final_msg)
        return replace(self, messages=messages, completed=True)

    def mark_error(self, error: str) -> AgentState:
        """Return new state marked as failed with an error message."""
        return replace(self, error=error)


class AgentOrchestrator:
    """Runs a single-agent ReAct loop until completion or max iterations."""

    def __init__(
        self,
        claude_client: AnthropicClient,
        tool_registry: ToolRegistry,
        tool_executor: ToolExecutor,
        event_emitter: EventEmitter,
        system_prompt: SystemPrompt | PromptAssembly,
        max_iterations: int = 50,
        observer: Observer | None = None,
        compaction_profile: CompactionProfile | None = None,
        initial_messages: tuple[dict[str, Any], ...] = (),
        thinking_budget: int = 0,
        skill_registry: SkillRegistry | None = None,
        persistent_store: PersistentMemoryStore | None = None,
        conversation_hooks: ConversationHooks | None = None,
        conversation_id: str | None = None,
        hook_user_id: Any | None = None,
    ) -> None:
        base_prompt_assembly = (
            system_prompt
            if isinstance(system_prompt, PromptAssembly)
            else PromptAssembly.from_system(system_prompt)
        )
        if not base_prompt_assembly.rendered.strip():
            raise ValueError("system_prompt must not be empty")
        settings = get_settings()
        self._client = claude_client
        self._base_registry = tool_registry
        self._executor = tool_executor
        self._emitter = event_emitter
        self._base_prompt_assembly = base_prompt_assembly
        self._system_prompt = base_prompt_assembly.system
        self._max_iterations = max_iterations
        resolved_profile = compaction_profile or resolve_compaction_profile(
            settings, "web_conversation"
        )
        self._observer = observer or Observer(
            profile=resolved_profile,
            claude_client=claude_client,
            summary_model=resolved_profile.summary_model or settings.LITE_MODEL,
        )
        self._compaction_profile = (
            getattr(observer, "profile", resolved_profile)
            if observer is not None
            else resolved_profile
        )
        self._persistent_store = persistent_store
        self._thinking_budget = thinking_budget
        self._task_complete_summary: str | None = None
        self._cancel_event = asyncio.Event()
        self._state = AgentState(messages=initial_messages)
        self._skill_registry = skill_registry
        self._skill_controller = SkillActivationController(
            skill_registry=skill_registry,
            executor=tool_executor,
            emitter=event_emitter,
            client=claude_client,
            install_context="orchestrator",
        )
        self._conversation_hooks = conversation_hooks or NoopConversationHooks()
        self._conversation_id = conversation_id
        self._hook_user_id = hook_user_id
        self._compaction_step = CompactionStep(
            observer=self._observer,
            profile=self._compaction_profile,
            emitter=event_emitter,
            summary_scope="conversation",
            conversation_id=conversation_id,
            user_id=hook_user_id,
            persistent_store=persistent_store,
            hooks=self._conversation_hooks,
        )
        self._run_lock = asyncio.Lock()
        self._last_tool_batch_signature: str | None = None
        self._identical_tool_batch_count: int = 0
        self._turn_artifact_ids: list[str] = []
        self._pending_mid_turn_update: SkillActivation | None = None
        self._current_turn_start_index = len(initial_messages)
        self._current_turn_base_messages = initial_messages

    async def on_task_complete(self, summary: str) -> None:
        """Callback for the task_complete tool."""
        self._task_complete_summary = summary

    def cancel(self) -> None:
        """Signal the current turn to stop."""
        self._cancel_event.set()

    def reset_cancel(self) -> None:
        """Clear the cancellation signal."""
        self._cancel_event.clear()

    def get_last_user_message(self) -> str | None:
        """Return the content of the most recent user message, or None."""
        return get_last_user_message_text(self._state.messages)

    def rollback_to_before_last_user_message(self) -> None:
        """Remove the last user message and everything after it."""
        index = find_last_user_message_index(self._state.messages)
        if index is None:
            return
        self._state = replace(
            self._state,
            messages=self._state.messages[:index],
            completed=False,
            error=None,
        )

    def _current_turn_messages_for_cancel(self) -> tuple[dict[str, Any], ...]:
        """Return the current-turn suffix only when history was not compacted."""
        base_messages = self._current_turn_base_messages
        if (
            len(self._state.messages) >= len(base_messages)
            and self._state.messages[: len(base_messages)] == base_messages
        ):
            return self._state.messages[len(base_messages) :]
        return ()

    @staticmethod
    def _append_text_guard_to_last_user_message(
        state: AgentState,
        extra_text: str,
    ) -> AgentState:
        """Append a text guard/nudge to the last user message when possible."""
        if not state.messages:
            return state.add_message({"role": "user", "content": extra_text})
        msgs = list(state.messages)
        last = msgs[-1]
        if last.get("role") != "user":
            return state.add_message({"role": "user", "content": extra_text})
        content = last.get("content")
        if isinstance(content, str):
            msgs[-1] = {**last, "content": f"{content}\n\n{extra_text}"}
        elif isinstance(content, list):
            msgs[-1] = {
                **last,
                "content": [
                    *content,
                    {"type": "text", "text": extra_text},
                ],
            }
        else:
            return state.add_message({"role": "user", "content": extra_text})
        return replace(state, messages=tuple(msgs))

    async def _emit_task_error(
        self,
        message: str,
        *,
        code: str = "agent_error",
        retryable: bool = False,
    ) -> None:
        await self._emitter.emit(
            EventType.TASK_ERROR,
            {"error": message, "code": code, "retryable": retryable},
        )

    # NOTE: concurrent run() calls are serialized via ``_run_lock``.
    async def run(
        self,
        user_message: str,
        attachments: tuple[Any, ...] = (),
        selected_skills: tuple[str, ...] = (),
        runtime_prompt_sections: tuple[str, ...] = (),
        turn_metadata: dict[str, Any] | None = None,
    ) -> str:
        """Execute the agent loop and return the final text response."""
        if not user_message.strip():
            raise ValueError("user_message must not be empty")

        async with self._run_lock:
            return await self._run_locked(
                user_message=user_message,
                attachments=attachments,
                selected_skills=selected_skills,
                runtime_prompt_sections=runtime_prompt_sections,
                turn_metadata=turn_metadata,
            )

    async def _run_locked(
        self,
        *,
        user_message: str,
        attachments: tuple[Any, ...],
        selected_skills: tuple[str, ...],
        runtime_prompt_sections: tuple[str, ...],
        turn_metadata: dict[str, Any] | None,
    ) -> str:
        logger.info("turn_start user_message_length={}", len(user_message))

        await self._emitter.emit(
            EventType.TURN_START,
            {
                "message": user_message,
                "attachments": serialize_attachment_metadata(attachments),
                "orchestrator_mode": "agent",
                **(turn_metadata or {}),
            },
        )

        self._executor.reset_turn_quotas()
        self._executor.reset_sandbox_template()
        reset_allowed_tools = getattr(self._executor, "reset_allowed_tools", None)
        if callable(reset_allowed_tools):
            reset_allowed_tools()
        reset_active_skill_directory = getattr(
            self._executor, "reset_active_skill_directory", None
        )
        if callable(reset_active_skill_directory):
            reset_active_skill_directory()
        self._last_tool_batch_signature = None
        self._identical_tool_batch_count = 0
        self._pending_mid_turn_update = None
        self._current_turn_start_index = len(self._state.messages)
        self._current_turn_base_messages = self._state.messages

        # Append user message to existing state (preserves conversation history)
        self._task_complete_summary = None

        # Auto-match skill for this turn via the shared activation controller
        cache_prompt = getattr(get_settings(), "PROMPT_CACHE_ENABLED", False)
        prompt_assembly = self._base_prompt_assembly
        if runtime_prompt_sections:
            dynamic_sections = tuple(
                section for section in runtime_prompt_sections if section
            )
            if dynamic_sections:
                prompt_assembly = prompt_assembly.with_volatile_sections(
                    *dynamic_sections,
                )

        self._skill_controller.begin_turn(
            prompt_assembly=prompt_assembly,
            registry=self._base_registry,
        )
        try:
            activation, _matched = (
                await self._skill_controller.match_and_activate_turn_start(
                    user_message=user_message,
                    selected_skills=selected_skills,
                    prompt_assembly=prompt_assembly,
                    registry=self._base_registry,
                    cache_prompt=cache_prompt,
                    attachments=attachments,
                )
            )
        except Exception as exc:
            error = str(exc)
            await self._emit_task_error(error, code="skill_setup", retryable=False)
            return f"Error: {error}"
        prompt_assembly = activation.prompt_assembly
        tools = activation.tools

        uploaded_paths: tuple[str, ...] = ()
        if attachments:
            try:
                uploaded_paths = await upload_attachments_to_sandbox(
                    self._executor,
                    attachments,
                )
            except Exception as exc:
                error = f"Failed to upload attached files to the sandbox: {exc}"
                await self._emit_task_error(
                    error,
                    code="attachment_upload",
                    retryable=False,
                )
                return f"Error: {error}"

        # Build message content only after uploads are verified.
        content = build_user_message_content(
            user_message,
            attachments,
            uploaded_paths=uploaded_paths,
        )

        self._state = self._state.add_message(
            {"role": "user", "content": content},
        )
        self._state = replace(self._state, completed=False, error=None, iteration=0)
        self._turn_artifact_ids = []

        while not self._state.completed and self._state.error is None:
            if self._cancel_event.is_set():
                break
            self._state = self._state.increment_iteration()
            self._state = await self._run_iteration(
                self._state,
                tools,
                prompt_assembly.system_with_cache_control(cache_prompt),
                prompt_assembly.rendered,
            )

            update = self._pending_mid_turn_update
            self._pending_mid_turn_update = None
            if update is None:
                # Check if activate_skill was invoked mid-turn (assistant scan)
                update = await self._skill_controller.check_mid_turn_from_messages(
                    list(self._state.messages),
                    cache_prompt=cache_prompt,
                )
            if update is not None:
                prompt_assembly = update.prompt_assembly
                tools = update.tools

        logger.info("turn_complete iterations={}", self._state.iteration)

        final_text, self._state = await finalize_conversation_turn(
            state=self._state,
            cancel_event=self._cancel_event,
            current_turn_messages=self._current_turn_messages_for_cancel(),
            base_messages=self._current_turn_base_messages,
            emitter=self._emitter,
            artifact_ids=self._turn_artifact_ids,
        )
        return final_text

    async def _run_iteration(
        self,
        state: AgentState,
        tools: list[dict[str, Any]],
        system_prompt: SystemPrompt | None = None,
        system_prompt_text: str | None = None,
    ) -> AgentState:
        """Run a single iteration of the ReAct loop."""
        effective_system = system_prompt or self._system_prompt
        effective_prompt = system_prompt_text or render_system_prompt(effective_system)

        settings = get_settings()
        if settings.VALIDATE_AGENT_MESSAGE_CHAIN:
            chain_warnings = collect_message_chain_warnings(state.messages)
            for w in chain_warnings:
                logger.warning("message_chain_warning detail={}", w)

        # Compact message history before the LLM call if needed
        compacted, did_compact = await self._compaction_step.maybe_compact(
            state.messages,
            effective_prompt,
            iteration=state.iteration,
        )
        if did_compact:
            logger.debug("compacting_message_history")
            state = replace(state, messages=compacted)

        logger.info("iteration={}/{}", state.iteration, self._max_iterations)

        await self._emitter.emit(
            EventType.ITERATION_START,
            {"iteration": state.iteration},
            iteration=state.iteration,
        )

        if state.iteration > self._max_iterations:
            logger.warning("max_iterations_exceeded limit={}", self._max_iterations)
            return state.mark_error(
                f"Exceeded maximum iterations ({self._max_iterations})",
            )

        llm_model = getattr(self._client, "default_model", "<unknown>")
        debug_logging_enabled = getattr(get_settings(), "AGENT_DEBUG_LOGGING", False)
        try:
            thinking_emitted_during_stream = False

            async def _on_text_delta(delta: str) -> None:
                await self._emitter.emit(
                    EventType.TEXT_DELTA,
                    {"delta": delta},
                    iteration=state.iteration,
                )

            async def _on_thinking_ready(thinking: str) -> None:
                nonlocal thinking_emitted_during_stream
                if not thinking:
                    return
                thinking_emitted_during_stream = True
                await self._emitter.emit(
                    EventType.THINKING,
                    {"thinking": thinking},
                    iteration=state.iteration,
                )

            stream_kwargs = dict(
                system=effective_system,
                messages=list(state.messages),
                tools=tools if tools else None,
                on_text_delta=_on_text_delta,
                thinking_budget=self._thinking_budget,
            )
            if debug_logging_enabled:
                logger.debug(
                    "orchestrator_llm_call model={} iteration={} messages={} tools={} thinking_budget={}",
                    llm_model,
                    state.iteration,
                    len(state.messages),
                    len(tools),
                    self._thinking_budget,
                )
            try:
                response = await self._client.create_message_stream(
                    **stream_kwargs,
                    on_thinking_ready=_on_thinking_ready,
                )
            except TypeError as exc:
                if "on_thinking_ready" not in str(exc):
                    raise
                response = await self._client.create_message_stream(**stream_kwargs)
        except Exception as exc:
            if debug_logging_enabled:
                logger.debug(
                    "orchestrator_llm_exception model={} iteration={} error_type={}",
                    llm_model,
                    state.iteration,
                    type(exc).__name__,
                )
            logger.error("llm_call_failed model={} error={}", llm_model, exc)
            return state.mark_error(format_llm_failure(exc))

        logger.info(
            "llm_response model={} stop_reason={} tool_calls={} input_tokens={} output_tokens={}",
            llm_model,
            response.stop_reason,
            len(response.tool_calls),
            response.usage.input_tokens,
            response.usage.output_tokens,
        )

        if response.thinking and not thinking_emitted_during_stream:
            await self._emitter.emit(
                EventType.THINKING,
                {"thinking": response.thinking},
                iteration=state.iteration,
            )

        await self._emitter.emit(
            EventType.LLM_RESPONSE,
            {
                "text": response.text,
                "tool_call_count": len(response.tool_calls),
                "stop_reason": response.stop_reason,
                "usage": response.usage,
            },
            iteration=state.iteration,
        )

        state = apply_response_to_state(state, response)

        if not response.tool_calls:
            return state.mark_completed()

        async def _post_tool_callback(tc: Any, result: Any) -> None:
            skill_name = self._skill_controller.requested_skill_name(tc.name, tc.input)
            if skill_name is None or not result.success:
                return
            updated = await self._skill_controller.apply_mid_turn(
                skill_name,
                tool_id=tc.id,
                messages=list(state.messages),
                cache_prompt=getattr(get_settings(), "PROMPT_CACHE_ENABLED", False),
            )
            if updated is not None:
                self._pending_mid_turn_update = updated

        try:
            tool_result = await process_tool_calls(
                state=state,
                tool_calls=response.tool_calls,
                executor=self._executor,
                emitter=self._emitter,
                stop_check=lambda: self._task_complete_summary is not None,
                cancel_check=lambda: self._cancel_event.is_set(),
                post_tool_callback=_post_tool_callback,
            )
        except Exception as exc:
            return state.mark_error(str(exc))
        state = tool_result.state
        self._turn_artifact_ids.extend(tool_result.artifact_ids)

        threshold = settings.STUCK_LOOP_TOOL_REPEAT_THRESHOLD
        if threshold > 0 and response.tool_calls:
            sig = tool_calls_fingerprint(response.tool_calls)
            if sig == self._last_tool_batch_signature:
                self._identical_tool_batch_count += 1
            else:
                self._last_tool_batch_signature = sig
                self._identical_tool_batch_count = 1
            if self._identical_tool_batch_count >= threshold:
                nudge = (
                    "System notice: The same tool calls were repeated several times. "
                    "Change approach: verify assumptions, try different tools, "
                    "or explain what is blocking progress."
                )
                await self._emitter.emit(
                    EventType.LOOP_GUARD_NUDGE,
                    {
                        "iteration": state.iteration,
                        "repeated_signature": sig[:500],
                    },
                    iteration=state.iteration,
                )
                state = self._append_text_guard_to_last_user_message(state, nudge)
                self._identical_tool_batch_count = 0
                self._last_tool_batch_signature = None

        # Check if task_complete tool was invoked during tool processing
        if self._task_complete_summary is not None:
            return state.mark_completed(self._task_complete_summary)

        return state
