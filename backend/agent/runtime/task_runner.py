"""Task agent runner for executing focused sub-tasks."""

from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from typing import Any, Literal

from agent.context.profiles import CompactionProfile, resolve_compaction_profile
from agent.llm.client import (
    AnthropicClient,
    LLMResponse,
    render_system_prompt,
)
from agent.runtime.helpers import (
    extract_final_text,
)
from agent.context.compaction import Observer
from agent.context.compaction_step import CompactionStep
from agent.runtime.engine import AgentLoop, LoopConfig, LoopPolicy
from agent.runtime.orchestrator import AgentState
from agent.runtime.system_prompt_sections import (
    build_memory_aware_system_prompt_sections,
)
from agent.runtime.skill_activation import SkillActivation, SkillActivationController
from agent.runtime.prompting import PromptAssembly
from agent.skills.loader import SkillRegistry
from agent.tools.executor import ToolExecutor
from agent.tools.registry import ToolRegistry
from api.events import EventEmitter
from config.settings import get_settings
from loguru import logger


FailureMode = Literal["cancel_downstream", "degrade", "replan"]
DependencyFailureMode = Literal["inherit", "cancel_downstream", "degrade", "replan"]


@dataclass(frozen=True)
class TaskAgentConfig:
    """Immutable configuration for a task agent."""

    task_description: str
    name: str = ""
    context: str = ""
    sandbox_template: str = "default"
    priority: int = 0
    depends_on: tuple[str, ...] = ()
    model: str | None = None
    timeout_seconds: float | None = None
    role: str = ""
    max_handoffs: int = 3
    dependency_failure_mode: DependencyFailureMode = "inherit"
    allow_redundant: bool = False


@dataclass(frozen=True)
class HandoffRequest:
    """Immutable request to hand off to a new agent."""

    target_role: str
    task_description: str
    context: str
    source_messages: tuple[dict, ...]
    remaining_handoffs: int


@dataclass(frozen=True)
class AgentRunMetrics:
    """Immutable metrics captured for a task agent run."""

    duration_seconds: float
    iterations: int
    tool_call_count: int
    context_compaction_count: int
    input_tokens: int
    output_tokens: int


@dataclass(frozen=True)
class AgentResult:
    """Immutable result of a task agent execution."""

    agent_id: str
    success: bool
    summary: str
    artifacts: tuple[str, ...] = ()
    error: str | None = None
    handoff: HandoffRequest | None = None
    failure_mode: FailureMode = "cancel_downstream"
    metrics: AgentRunMetrics | None = None
    skip_execution: bool = False
    replan_required: bool = False
    completed_via_task_complete: bool = False


@dataclass(frozen=True)
class TaskAgentPromptTemplate:
    """Reusable immutable prompt template for task agents."""

    header: str
    guidelines: str

    def render(self, config: TaskAgentConfig) -> str:
        """Render the full system prompt for a specific task-agent config."""
        role_section = f"\nYour role: {config.role}\n" if config.role else ""
        context_section = (
            f"\nAdditional context:\n{config.context}" if config.context else ""
        )
        return (
            f"{self.header}\n"
            f"{role_section}"
            f"Your task: {config.task_description}\n"
            f"{context_section}\n\n"
            f"{self.guidelines}"
        )


TASK_AGENT_PROMPT_TEMPLATE = TaskAgentPromptTemplate(
    header="You are a task agent focused on completing a specific objective.",
    guidelines="""Guidelines:
- Focus exclusively on the assigned task
- Use available tools to accomplish the objective
- Use agent_send and agent_receive to coordinate with other agents if needed
- Be thorough but efficient
- When done, call task_complete with a detailed summary of what was accomplished
- Include any relevant file paths or outputs in your summary""",
)

_TASK_AGENT_PRESERVED_TOOL_NAMES = (
    "activate_skill",
    "task_complete",
    "agent_handoff",
    "agent_send",
    "agent_receive",
)


def ensure_task_agent_name_suffix(name: str) -> str:
    """Ensure user-facing task-agent names end with the ``agent`` suffix."""
    trimmed = name.strip()
    if not trimmed:
        return ""
    if trimmed.lower().endswith(" agent"):
        return trimmed
    return f"{trimmed} agent"


def _build_system_prompt(
    config: TaskAgentConfig,
    *,
    prompt_template: TaskAgentPromptTemplate = TASK_AGENT_PROMPT_TEMPLATE,
    memory_entries: list[dict[str, str]] | None = None,
    skill_registry: SkillRegistry | None = None,
    settings: Any | None = None,
) -> str:
    """Build the system prompt from a TaskAgentConfig."""
    return render_system_prompt(
        build_memory_aware_system_prompt_sections(
            prompt_template.render(config),
            memory_entries,
            skill_registry,
            settings=settings,
        )
    )


class TaskAgentRunner(LoopPolicy):
    """Runs a focused sub-task using a ReAct loop."""

    def __init__(
        self,
        agent_id: str,
        config: TaskAgentConfig,
        claude_client: AnthropicClient,
        tool_registry: ToolRegistry,
        tool_executor: ToolExecutor,
        event_emitter: EventEmitter,
        max_iterations: int = 50,
        observer: Observer | None = None,
        compaction_profile: CompactionProfile | None = None,
        skill_registry: SkillRegistry | None = None,
        prompt_template: TaskAgentPromptTemplate = TASK_AGENT_PROMPT_TEMPLATE,
        memory_entries: list[dict[str, str]] | None = None,
        shared_tools: list[dict[str, Any]] | None = None,
        shared_tools_fingerprint: str | None = None,
    ) -> None:
        if not agent_id:
            raise ValueError("agent_id must not be empty")
        if not config.task_description.strip():
            raise ValueError("task_description must not be empty")
        settings = get_settings()

        self._agent_id = agent_id
        self._config = config
        self._client = claude_client
        self._registry = tool_registry
        self._executor = tool_executor
        self._emitter = event_emitter
        self._max_iterations = max_iterations
        self._skill_registry = skill_registry
        resolved_profile = compaction_profile or resolve_compaction_profile(
            settings, "task_agent"
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
        self._prompt_template = prompt_template
        self._system_prompt = _build_system_prompt(
            config,
            prompt_template=prompt_template,
            memory_entries=memory_entries,
            skill_registry=(
                skill_registry if getattr(settings, "SKILLS_ENABLED", True) else None
            ),
            settings=settings,
        )
        self._skill_controller = SkillActivationController(
            skill_registry=skill_registry,
            executor=tool_executor,
            emitter=event_emitter,
            client=claude_client,
            install_context="task_runner",
            preserved_tool_names=_TASK_AGENT_PRESERVED_TOOL_NAMES,
        )
        self._compaction_step = CompactionStep(
            observer=self._observer,
            profile=self._compaction_profile,
            emitter=event_emitter,
            summary_scope="task_agent",
            agent_id=agent_id,
            emit_iteration=False,
            on_compacted=self._increment_compaction_count,
        )
        self._task_complete_summary: str | None = None
        self._handoff_request: HandoffRequest | None = None
        self._artifact_ids: list[str] = []
        self._iterations = 0
        self._tool_call_count = 0
        self._context_compaction_count = 0
        self._input_tokens = 0
        self._output_tokens = 0
        self._shared_tools = shared_tools
        self._shared_tools_fingerprint = shared_tools_fingerprint
        self._completed_via_task_complete = False
        self._loop = AgentLoop(
            client=claude_client,
            emitter=event_emitter,
            executor=tool_executor,
            compaction_step=self._compaction_step,
            skill_controller=self._skill_controller,
            policy=self,
        )

    def _increment_compaction_count(self) -> None:
        """Record that a context compaction ran (metrics)."""
        self._context_compaction_count += 1

    async def on_task_complete(self, summary: str) -> None:
        """Callback for the task_complete tool."""
        self._task_complete_summary = summary
        self._completed_via_task_complete = True

    async def on_handoff(self, request: HandoffRequest) -> None:
        """Callback for the agent_handoff tool."""
        self._handoff_request = request

    async def run(self) -> AgentResult:
        """Execute the task agent loop and return an AgentResult."""
        self._reset_run_state()
        reset_sandbox_template = getattr(self._executor, "reset_sandbox_template", None)
        if callable(reset_sandbox_template):
            reset_sandbox_template()
        configured_template = self._config.sandbox_template.strip()
        if configured_template:
            set_sandbox_template = getattr(self._executor, "set_sandbox_template", None)
            if callable(set_sandbox_template):
                set_sandbox_template(configured_template)
        reset_active_skill_directory = getattr(
            self._executor, "reset_active_skill_directory", None
        )
        if callable(reset_active_skill_directory):
            reset_active_skill_directory()
        reset_allowed_tools = getattr(self._executor, "reset_allowed_tools", None)
        if callable(reset_allowed_tools):
            reset_allowed_tools()
        started_at = time.perf_counter()
        settings = get_settings()
        timeout_seconds = (
            self._config.timeout_seconds
            if self._config.timeout_seconds is not None
            else settings.AGENT_TIMEOUT_SECONDS
        )

        try:
            final_text = await asyncio.wait_for(
                self._execute_loop(),
                timeout=timeout_seconds,
            )
        except asyncio.TimeoutError:
            error = f"Task agent timed out after {timeout_seconds}s"
            metrics = self._build_metrics(started_at)
            return AgentResult(
                agent_id=self._agent_id,
                success=False,
                summary="",
                artifacts=tuple(self._artifact_ids),
                error=error,
                failure_mode="cancel_downstream",
                metrics=metrics,
            )
        except Exception as exc:
            logger.exception("Task agent {} failed: {}", self._agent_id, exc)
            metrics = self._build_metrics(started_at)
            return AgentResult(
                agent_id=self._agent_id,
                success=False,
                summary="",
                artifacts=tuple(self._artifact_ids),
                error=str(exc),
                metrics=metrics,
            )

        metrics = self._build_metrics(started_at)
        return AgentResult(
            agent_id=self._agent_id,
            success=True,
            summary=final_text,
            artifacts=tuple(self._artifact_ids),
            handoff=self._handoff_request,
            metrics=metrics,
            completed_via_task_complete=self._completed_via_task_complete,
        )

    def _reset_run_state(self) -> None:
        """Reset per-run counters before starting execution."""
        self._artifact_ids = []
        self._iterations = 0
        self._tool_call_count = 0
        self._context_compaction_count = 0
        self._input_tokens = 0
        self._output_tokens = 0
        self._task_complete_summary = None
        self._handoff_request = None
        self._completed_via_task_complete = False

    def _build_metrics(self, started_at: float) -> AgentRunMetrics:
        """Build a metrics snapshot for the current run."""
        return AgentRunMetrics(
            duration_seconds=time.perf_counter() - started_at,
            iterations=self._iterations,
            tool_call_count=self._tool_call_count,
            context_compaction_count=self._context_compaction_count,
            input_tokens=self._input_tokens,
            output_tokens=self._output_tokens,
        )

    async def _execute_loop(self) -> str:
        """Run the ReAct loop until completion or error."""
        state = AgentState().add_message(
            {"role": "user", "content": self._config.task_description},
        )
        cache_prompt = getattr(get_settings(), "PROMPT_CACHE_ENABLED", False)
        prompt_assembly = PromptAssembly.from_system(self._system_prompt)

        self._skill_controller.begin_turn(
            prompt_assembly=prompt_assembly,
            registry=self._registry,
        )
        activation, _matched = (
            await self._skill_controller.match_and_activate_turn_start(
                user_message=self._config.task_description,
                selected_skills=(),
                prompt_assembly=prompt_assembly,
                registry=self._registry,
                cache_prompt=cache_prompt,
            )
        )
        prompt_assembly = activation.prompt_assembly
        tools = self._tools_for_registry(activation, cache_prompt)

        state = await self._loop.run_turn(
            state=state,
            prompt_assembly=prompt_assembly,
            tools=tools,
            cache_prompt=cache_prompt,
        )

        if state.error:
            raise RuntimeError(state.error)

        return extract_final_text(state)

    def _tools_for_registry(
        self,
        activation: SkillActivation,
        cache_prompt: bool,
    ) -> list[dict[str, Any]]:
        """Reuse the manager's shared tool payload when the registry matches."""
        if (
            self._shared_tools is not None
            and self._shared_tools_fingerprint
            == activation.registry.anthropic_tools_fingerprint()
        ):
            return self._shared_tools
        return activation.tools

    @property
    def loop_config(self) -> LoopConfig:
        settings = get_settings()
        return LoopConfig(
            max_iterations=self._max_iterations,
            model=self._config.model or settings.TASK_MODEL,
            emit_iteration_start=False,
            emit_llm_response=False,
            agent_id=self._agent_id,
            debug_label="task_runner",
            debug_logging=getattr(settings, "AGENT_DEBUG_LOGGING", False),
        )

    def loop_on_iteration_begin(self, state: AgentState) -> None:
        self._iterations = state.iteration

    def loop_stop_processing(self) -> bool:
        return (
            self._task_complete_summary is not None
            or self._handoff_request is not None
        )

    async def loop_on_llm_usage(self, response: LLMResponse) -> None:
        self._input_tokens += response.usage.input_tokens
        self._output_tokens += response.usage.output_tokens

    async def loop_on_tools_processed(
        self,
        state: AgentState,
        response: LLMResponse,
        tool_result: Any,
    ) -> AgentState:
        self._tool_call_count += tool_result.processed_count
        for artifact_id in tool_result.artifact_ids:
            if artifact_id not in self._artifact_ids:
                self._artifact_ids.append(artifact_id)
        return state

    async def loop_on_task_complete(self, state: AgentState) -> AgentState | None:
        if self._task_complete_summary is not None:
            return state.mark_completed(self._task_complete_summary)

        if self._handoff_request is not None:
            handoff_with_messages = HandoffRequest(
                target_role=self._handoff_request.target_role,
                task_description=self._handoff_request.task_description,
                context=self._handoff_request.context,
                source_messages=state.messages,
                remaining_handoffs=self._handoff_request.remaining_handoffs,
            )
            self._handoff_request = handoff_with_messages
            return state.mark_completed("Handing off to specialist agent.")

        return None
