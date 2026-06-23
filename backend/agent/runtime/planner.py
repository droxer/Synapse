"""Planner orchestrator that decomposes tasks into sub-agent work."""

from __future__ import annotations

import asyncio
import re
from dataclasses import replace
from typing import TYPE_CHECKING, Any, Protocol

from loguru import logger

from agent.context.profiles import CompactionProfile, resolve_compaction_profile
from agent.llm.client import (
    AnthropicClient,
    LLMResponse,
    SystemPrompt,
    format_llm_failure,
    render_system_prompt,
)
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
from agent.context.compaction import Observer
from agent.context.compaction_step import CompactionStep
from agent.runtime.orchestrator import AgentState
from agent.runtime.prompting import PromptAssembly
from agent.runtime.skill_activation import SkillActivation, SkillActivationController
from agent.runtime.task_runner import TaskAgentConfig
from agent.runtime.turn_attachments import (
    build_user_message_content,
    upload_attachments_to_sandbox,
)
from agent.skills.loader import SkillRegistry
from agent.tools.executor import ToolExecutor
from agent.tools.meta.plan_create import PlanCreate
from agent.tools.meta.planner_state import PlannerState
from agent.tools.meta.spawn_task_agent import SpawnTaskAgent
from agent.tools.meta.wait_for_agents import WaitForAgents
from agent.tools.registry import ToolRegistry
from api.events import EventEmitter, EventType
from api.models import serialize_attachment_metadata
from config.settings import get_settings

if TYPE_CHECKING:
    from agent.memory.store import PersistentMemoryStore

PLANNER_SYSTEM_PROMPT = """You are a planning agent that decomposes complex tasks into sub-tasks.

Your workflow:
1. Analyze the user's request
2. Call plan_create with the list of steps you intend to execute and classify each as planner-owned, sequential-worker, or parallel-worker
3. Use agent_spawn only for worker steps that need bounded independent execution (use the same name from the plan)
4. Use agent_wait to wait for results
5. Synthesize the results and communicate to the user via user_message
6. Call task_complete when done

Guidelines:
- Always call plan_create FIRST before spawning any agents
- Planning does not imply delegation: use zero workers for explanations, direct Q&A, simple edits, and predictable single-owner work
- Do not spawn agents when one agent can complete the task with existing tools
- Prefer one worker plus planner-side synthesis for bounded execution
- Spawn 2-4 agents only for truly independent sub-tasks
- Use wide fanout only for many homogeneous research or data items
- Prefer fixed sequential execution only when the task is a predictable pipeline
- Every agent_spawn must include a concrete deliverable, ownership_scope, and independence_reason
- Each agent gets its own sandbox if needed
- Keep sub-tasks focused and specific
- You do NOT have sandbox access — delegate execution to task agents
"""

_TRIVIAL_PLANNER_MESSAGES = {
    "",
    "hi",
    "hello",
    "hey",
    "thanks",
    "thank you",
    "ok",
    "okay",
    "continue",
}
_ACTIONABLE_PLANNER_KEYWORDS = (
    "analyze",
    "audit",
    "build",
    "compare",
    "create",
    "debug",
    "design",
    "draft",
    "edit",
    "evaluate",
    "fix",
    "generate",
    "implement",
    "investigate",
    "plan",
    "prepare",
    "refactor",
    "research",
    "review",
    "run",
    "search",
    "summarize",
    "test",
    "update",
    "write",
)
_QUESTION_ONLY_PREFIXES = (
    "what ",
    "when ",
    "where ",
    "who ",
    "why ",
    "how ",
    "can you explain",
    "could you explain",
    "tell me",
)
_CLARIFICATION_PREFIXES = (
    "what ",
    "which ",
    "who ",
    "where ",
    "when ",
    "why ",
    "how ",
    "can you ",
    "could you ",
    "would you ",
    "do you ",
    "did you ",
    "is the ",
    "are the ",
    "should i ",
    "should we ",
    "please clarify",
)
_SUPPORTED_TURN_LOCALES = {
    "en": "English",
    "zh-CN": "Simplified Chinese",
    "zh-TW": "Traditional Chinese",
}
_PLANNER_PRESERVED_TOOL_NAMES = (
    "task_complete",
    "plan_create",
    "agent_spawn",
    "agent_wait",
)


def _normalize_policy_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _explicit_planner_requires_visible_plan(
    user_message: str,
    attachments: tuple[Any, ...],
) -> bool:
    if attachments:
        return True
    normalized = _normalize_policy_text(user_message)
    if normalized in _TRIVIAL_PLANNER_MESSAGES:
        return False
    return bool(normalized)


def _explicit_planner_requires_worker_delegation(
    user_message: str,
    attachments: tuple[Any, ...],
) -> bool:
    if not _explicit_planner_requires_visible_plan(user_message, attachments):
        return False
    if attachments:
        return True

    normalized = _normalize_policy_text(user_message)
    if any(keyword in normalized for keyword in _ACTIONABLE_PLANNER_KEYWORDS):
        return True

    if normalized.startswith(_QUESTION_ONLY_PREFIXES) and "?" in normalized:
        return False

    return len(normalized.split()) >= 12 and not normalized.endswith("?")


def _build_turn_locale_runtime_sections(
    turn_metadata: dict[str, Any] | None,
) -> tuple[str, ...]:
    locale = (turn_metadata or {}).get("locale")
    if not isinstance(locale, str):
        return ()
    language_name = _SUPPORTED_TURN_LOCALES.get(locale)
    if language_name is None:
        return ()
    return (
        (
            "User locale for this turn:\n"
            f"- locale: {locale}\n"
            f"- preferred_language: {language_name}\n"
            "- Keep user-visible planner output in this language unless the user explicitly requests another one.\n"
            "- In particular, plan_create step names and descriptions must be written in this language."
        ),
    )


def _is_clarification_question(text: str) -> bool:
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    if len(lines) != 1:
        return False
    candidate = lines[0]
    normalized = _normalize_policy_text(candidate)
    if not normalized or not candidate.endswith("?"):
        return False
    if candidate.count("?") != 1:
        return False
    return normalized.startswith(_CLARIFICATION_PREFIXES)


def _spawn_limit_for_execution_shape(
    execution_shape: str | None,
    settings: Any,
) -> int | None:
    if execution_shape in {"single_agent", "prompt_chain"}:
        return 0
    if execution_shape == "parallel":
        return getattr(settings, "EXECUTION_SHAPE_PARALLEL_SOFT_LIMIT", 3)
    if execution_shape == "orchestrator_workers":
        return getattr(settings, "EXECUTION_SHAPE_ORCHESTRATOR_WORKERS_SOFT_LIMIT", 4)
    return None


class SubAgentManagerProtocol(Protocol):
    """Protocol for managing spawned task agents."""

    async def spawn(self, config: TaskAgentConfig) -> str:
        """Spawn a task agent and return its ID."""
        ...

    async def wait(self, agent_ids: list[str] | None = None) -> dict[str, Any]:
        """Wait for agents to complete and return their results."""
        ...

    async def cleanup(self) -> None:
        """Clean up all managed sub-agents."""
        ...


class PlannerOrchestrator:
    """Top-level orchestrator that decomposes requests into sub-agent tasks.

    Uses a planning model to reason about task decomposition and coordinates
    sub-agents via a SubAgentManager. Follows the same ReAct loop pattern
    as AgentOrchestrator but with planner-specific system prompt and tools.

    Conversation history is preserved across ``run()`` calls.
    """

    def __init__(
        self,
        claude_client: AnthropicClient,
        tool_registry: ToolRegistry,
        tool_executor: ToolExecutor,
        event_emitter: EventEmitter,
        sub_agent_manager: SubAgentManagerProtocol,
        max_iterations: int = 30,
        observer: Observer | None = None,
        compaction_profile: CompactionProfile | None = None,
        system_prompt: SystemPrompt | PromptAssembly = "",
        skill_registry: SkillRegistry | None = None,
        initial_messages: tuple[dict[str, Any], ...] = (),
        persistent_store: PersistentMemoryStore | None = None,
        conversation_hooks: ConversationHooks | None = None,
        conversation_id: str | None = None,
        hook_user_id: Any | None = None,
    ) -> None:
        if max_iterations < 1:
            raise ValueError("max_iterations must be at least 1")
        settings = get_settings()
        system_source: SystemPrompt | PromptAssembly = (
            system_prompt or PLANNER_SYSTEM_PROMPT
        )
        base_prompt_assembly = (
            system_source
            if isinstance(system_source, PromptAssembly)
            else PromptAssembly.from_system(system_source)
        )
        if not base_prompt_assembly.rendered.strip():
            raise ValueError("system_prompt must not be empty")

        self._client = claude_client
        self._sub_agent_manager = sub_agent_manager
        self._emitter = event_emitter
        self._max_iterations = max_iterations
        resolved_profile = compaction_profile or resolve_compaction_profile(
            settings, "planner"
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
        self._task_complete_summary: str | None = None
        self._cancel_event = asyncio.Event()
        self._base_prompt_assembly = base_prompt_assembly
        self._system_prompt = base_prompt_assembly.system
        self._skill_registry = skill_registry
        self._persistent_store = persistent_store
        self._conversation_hooks = conversation_hooks or NoopConversationHooks()
        self._conversation_id = conversation_id
        self._hook_user_id = hook_user_id
        self._planner_state = PlannerState()

        # Register meta-tools into the provided registry
        registry_with_meta = tool_registry.register(
            PlanCreate(
                event_emitter=event_emitter,
                planner_state=self._planner_state,
            ),
        )
        registry_with_meta = registry_with_meta.register(
            SpawnTaskAgent(
                sub_agent_manager=sub_agent_manager,
                event_emitter=event_emitter,
                planner_state=self._planner_state,
            ),
        )
        registry_with_meta = registry_with_meta.register(
            WaitForAgents(
                sub_agent_manager=sub_agent_manager,
                cancel_check=lambda: self._cancel_event.is_set(),
                planner_state=self._planner_state,
            ),
        )

        self._registry = registry_with_meta
        self._executor = tool_executor.with_registry(registry_with_meta)
        self._skill_controller = SkillActivationController(
            skill_registry=skill_registry,
            executor=self._executor,
            emitter=event_emitter,
            client=claude_client,
            install_context="planner",
            preserved_tool_names=_PLANNER_PRESERVED_TOOL_NAMES,
        )
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

        # Persistent conversation state — appended to on each run() call
        self._state = AgentState(messages=initial_messages)
        self._run_lock = asyncio.Lock()
        self._turn_artifact_ids: list[str] = []
        self._pending_mid_turn_update: SkillActivation | None = None
        self._current_turn_start_index = len(initial_messages)
        self._current_turn_base_messages = initial_messages
        self._explicit_planner_requested = False
        self._explicit_planner_requires_plan = False
        self._explicit_planner_requires_worker = False
        self._explicit_policy_nudge_count = 0
        self._explicit_policy_reminder: str | None = None

    async def on_task_complete(self, summary: str) -> None:
        """Callback for the task_complete tool."""
        self._task_complete_summary = summary

    def cancel(self) -> None:
        """Signal the current planner turn to stop."""
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

    async def run(
        self,
        user_message: str,
        attachments: tuple[Any, ...] = (),
        selected_skills: tuple[str, ...] = (),
        runtime_prompt_sections: tuple[str, ...] = (),
        turn_metadata: dict[str, Any] | None = None,
    ) -> str:
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
        """Execute the planner loop and return the final synthesized response.

        Emits lifecycle events throughout execution and cleans up
        sub-agents on completion (success or failure).
        Conversation history is preserved across calls.
        """
        if not user_message.strip():
            raise ValueError("user_message must not be empty")

        await self._emitter.emit(
            EventType.TURN_START,
            {
                "message": user_message,
                "attachments": serialize_attachment_metadata(attachments),
                "orchestrator_mode": "planner",
                **(turn_metadata or {}),
            },
        )
        self._planner_state.reset()
        settings = get_settings()
        execution_shape = (turn_metadata or {}).get("execution_shape")
        self._planner_state.configure_spawn_policy(
            execution_shape=execution_shape
            if isinstance(execution_shape, str)
            else None,
            max_worker_spawns=_spawn_limit_for_execution_shape(
                execution_shape if isinstance(execution_shape, str) else None,
                settings,
            ),
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
        self._task_complete_summary = None
        self._pending_mid_turn_update = None
        self._current_turn_start_index = len(self._state.messages)
        self._current_turn_base_messages = self._state.messages
        explicit_planner = bool((turn_metadata or {}).get("explicit_planner"))
        self._explicit_planner_requested = explicit_planner
        self._explicit_planner_requires_plan = (
            explicit_planner
            and _explicit_planner_requires_visible_plan(user_message, attachments)
        )
        self._explicit_planner_requires_worker = False
        self._explicit_policy_nudge_count = 0
        self._explicit_policy_reminder = None

        cache_prompt = getattr(get_settings(), "PROMPT_CACHE_ENABLED", False)
        prompt_assembly = self._base_prompt_assembly
        if runtime_prompt_sections:
            dynamic = tuple(s for s in runtime_prompt_sections if s)
            if dynamic:
                prompt_assembly = prompt_assembly.with_volatile_sections(
                    *dynamic,
                )
        explicit_sections = self._build_explicit_planner_runtime_sections()
        if explicit_sections:
            prompt_assembly = prompt_assembly.with_volatile_sections(*explicit_sections)
        locale_sections = _build_turn_locale_runtime_sections(turn_metadata)
        if locale_sections:
            prompt_assembly = prompt_assembly.with_volatile_sections(*locale_sections)
        # Skill matching via the shared activation controller
        self._skill_controller.begin_turn(
            prompt_assembly=prompt_assembly,
            registry=self._registry,
        )
        try:
            activation, _matched = (
                await self._skill_controller.match_and_activate_turn_start(
                    user_message=user_message,
                    selected_skills=selected_skills,
                    prompt_assembly=prompt_assembly,
                    registry=self._registry,
                    cache_prompt=cache_prompt,
                    attachments=attachments,
                )
            )
        except Exception as exc:
            await self._emitter.emit(
                EventType.TASK_ERROR,
                {"error": str(exc), "code": "skill_setup", "retryable": False},
            )
            return f"Error: {exc}"
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
                err = f"Failed to upload attached files to the sandbox: {exc}"
                await self._emitter.emit(
                    EventType.TASK_ERROR,
                    {
                        "error": err,
                        "code": "attachment_upload",
                        "retryable": False,
                    },
                )
                return f"Error: {err}"

        content: str | list[dict[str, Any]] = build_user_message_content(
            user_message,
            attachments,
            uploaded_paths=uploaded_paths,
        )
        self._state = self._state.add_message({"role": "user", "content": content})
        self._state = replace(self._state, completed=False, error=None, iteration=0)
        self._turn_artifact_ids = []

        model = get_settings().PLANNING_MODEL

        try:
            while not self._state.completed and self._state.error is None:
                if self._cancel_event.is_set():
                    break
                iteration_prompt_assembly = prompt_assembly
                if self._explicit_policy_reminder:
                    iteration_prompt_assembly = (
                        iteration_prompt_assembly.with_volatile_sections(
                            self._explicit_policy_reminder
                        )
                    )
                self._state = self._state.increment_iteration()
                self._state = await self._run_iteration(
                    self._state,
                    tools,
                    model,
                    iteration_prompt_assembly.system_with_cache_control(cache_prompt),
                    iteration_prompt_assembly.rendered,
                )

                update = self._pending_mid_turn_update
                self._pending_mid_turn_update = None
                if update is None:
                    update = await self._skill_controller.check_mid_turn_from_messages(
                        list(self._state.messages),
                        cache_prompt=cache_prompt,
                    )
                if update is not None:
                    prompt_assembly = update.prompt_assembly
                    tools = update.tools
        finally:
            await self._cleanup_sub_agents()

        return await self._finalize(self._state)

    async def _run_iteration(
        self,
        state: AgentState,
        tools: list[dict[str, Any]],
        model: str,
        system_prompt: SystemPrompt | None = None,
        system_prompt_text: str | None = None,
    ) -> AgentState:
        """Run a single iteration of the planner ReAct loop."""
        effective_system = system_prompt or self._system_prompt
        effective_prompt = system_prompt_text or render_system_prompt(effective_system)

        # Compact history before the LLM call if needed
        compacted, did_compact = await self._compaction_step.maybe_compact(
            state.messages,
            effective_prompt,
            iteration=state.iteration,
        )
        if did_compact:
            state = replace(state, messages=compacted)

        await self._emitter.emit(
            EventType.ITERATION_START,
            {"iteration": state.iteration},
            iteration=state.iteration,
        )

        if state.iteration > self._max_iterations:
            return state.mark_error(
                f"Exceeded maximum iterations ({self._max_iterations})",
            )

        response, llm_error = await self._call_llm(
            state, tools, model, effective_system, effective_prompt
        )
        if llm_error is not None:
            return state.mark_error(llm_error)

        await self._emit_llm_response(state, response)

        state = apply_response_to_state(state, response)

        if not response.tool_calls:
            if self._explicit_planner_completion_is_exempt(response.text):
                self._explicit_policy_reminder = None
                return state.mark_completed()
            policy_state = await self._apply_explicit_planner_policy(
                state,
                trigger="inline_completion",
            )
            if policy_state is not None:
                return policy_state
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

        if self._task_complete_summary is not None:
            policy_state = await self._apply_explicit_planner_policy(
                state,
                trigger="task_complete",
            )
            if policy_state is not None:
                return policy_state
            return state.mark_completed(self._task_complete_summary)

        return state

    async def _call_llm(
        self,
        state: AgentState,
        tools: list[dict[str, Any]],
        model: str,
        system_prompt: SystemPrompt | None = None,
        system_prompt_text: str | None = None,
    ) -> tuple[LLMResponse | None, str | None]:
        """Call the LLM with streaming and return the response or an error."""
        try:

            async def _on_text_delta(delta: str) -> None:
                await self._emitter.emit(
                    EventType.TEXT_DELTA,
                    {"delta": delta},
                    iteration=state.iteration,
                )

            response = await self._client.create_message_stream(
                system=system_prompt or self._system_prompt,
                messages=list(state.messages),
                tools=tools if tools else None,
                model=model,
                on_text_delta=_on_text_delta,
            )
            return response, None
        except Exception as exc:
            logger.exception("llm_call_failed_planning model={} error={}", model, exc)
            return None, format_llm_failure(exc)

    async def _emit_llm_response(
        self,
        state: AgentState,
        response: LLMResponse,
    ) -> None:
        """Emit an LLM_RESPONSE event."""
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

    def _explicit_planner_completion_is_exempt(self, text: str) -> bool:
        if not self._explicit_planner_requested:
            return False
        return _is_clarification_question(text)

    def _build_explicit_planner_runtime_sections(self) -> tuple[str, ...]:
        if not self._explicit_planner_requested:
            return ()

        sections = [
            (
                "Explicit planner mode is enabled for this turn.\n"
                "- Produce visible planner activity rather than answering inline.\n"
                "- Call plan_create before finishing unless you are only asking a "
                "clarification question or handling trivial chit-chat.\n"
                "- Do not spawn workers unless delegation is materially useful; "
                "planner mode may complete with planner-owned steps only."
            )
        ]
        return tuple(sections)

    def _explicit_planner_policy_violation(self) -> str | None:
        if not self._explicit_planner_requested:
            return None
        if self._explicit_planner_requires_plan and not self._planner_state.has_plan:
            return (
                "System notice: Planner mode was explicitly forced for this turn. "
                "Before you finish, call plan_create so the user sees a visible plan. "
                "Only skip this if you are asking a clarification question."
            )
        if (
            self._planner_state.spawned_agent_count > 0
            and self._planner_state.waited_agent_count == 0
        ):
            return (
                "System notice: This planner turn spawned a worker, but you have "
                "not waited for any worker results yet. Before you finish, call "
                "agent_wait and then synthesize the worker output for the user."
            )
        return None

    async def _apply_explicit_planner_policy(
        self,
        state: AgentState,
        *,
        trigger: str,
    ) -> AgentState | None:
        violation = self._explicit_planner_policy_violation()
        if violation is None:
            self._explicit_policy_reminder = None
            return None

        self._task_complete_summary = None
        self._explicit_policy_reminder = violation
        self._explicit_policy_nudge_count += 1
        if self._explicit_policy_nudge_count >= 3:
            return state.mark_error(
                "Explicit planner mode could not produce the required visible plan or worker delegation."
            )

        await self._emitter.emit(
            EventType.LOOP_GUARD_NUDGE,
            {
                "iteration": state.iteration,
                "repeated_signature": f"explicit_planner_policy:{trigger}",
            },
            iteration=state.iteration,
        )
        return state

    async def _finalize(self, state: AgentState) -> str:
        """Emit final event and return the result text."""
        final_text, self._state = await finalize_conversation_turn(
            state=state,
            cancel_event=self._cancel_event,
            current_turn_messages=self._current_turn_messages_for_cancel(),
            base_messages=self._current_turn_base_messages,
            emitter=self._emitter,
            artifact_ids=self._turn_artifact_ids,
        )
        return final_text

    async def _cleanup_sub_agents(self) -> None:
        """Safely clean up all spawned sub-agents."""
        try:
            await self._sub_agent_manager.cleanup()
        except Exception as exc:
            logger.exception("failed_to_cleanup_sub_agents error={}", exc)
