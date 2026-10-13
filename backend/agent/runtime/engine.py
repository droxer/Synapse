"""Shared ReAct loop engine for agent runtimes.

The single-agent orchestrator, planner, and task-agent runner share one
iteration mechanism: compact, (optionally) announce the iteration, guard the
iteration ceiling, stream an LLM response, apply it, run tool calls (handling
mid-turn skill activation), and check for completion. :class:`AgentLoop` owns
that mechanism once; each runtime supplies a :class:`LoopPolicy` describing the
parts that genuinely differ (model, event surface, completion rules, metrics).
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, replace
from typing import TYPE_CHECKING, Any

from loguru import logger

from agent.llm.client import (
    AnthropicClient,
    LLMResponse,
    SystemPrompt,
    format_llm_failure,
)
from agent.context.compaction_step import CompactionStep
from agent.runtime.helpers import (
    MAX_TOKENS_CONTINUE_PROMPT,
    MAX_TOKENS_TOOL_RESULT,
    apply_response_to_state,
    build_error_tool_results_message,
    process_tool_calls,
)
from agent.runtime.message_chain import collect_message_chain_warnings
from agent.runtime.message_repair import repair_message_chain
from agent.runtime.prompting import PromptAssembly
from agent.runtime.skill_activation import SkillActivationController
from agent.tools.executor import ToolExecutor
from agent.events import EventEmitter, EventType

if TYPE_CHECKING:
    from agent.runtime.orchestrator import AgentState

# Bound on "continue" nudges / truncated-tool-call retries after a response
# stopped at ``max_tokens`` within a single turn.
MAX_TOKENS_RECOVERIES_PER_TURN = 2
_STOP_REASON_MAX_TOKENS = "max_tokens"


@dataclass(frozen=True)
class LoopConfig:
    """Per-runtime knobs for the shared loop that are plain values."""

    max_iterations: int
    model: str | None = None
    thinking_budget: int = 0
    emit_thinking: bool = False
    emit_iteration_start: bool = True
    emit_llm_response: bool = True
    validate_message_chain: bool = False
    agent_id: str | None = None
    debug_label: str = "agent"
    debug_logging: bool = False


class LoopPolicy(ABC):
    """Hooks describing how a runtime diverges from the shared loop.

    Runtime classes subclass this (alongside their own bases) and override only
    the hooks they need; every hook has a behavior-neutral default. The single
    required override is :attr:`loop_config`.
    """

    @property
    @abstractmethod
    def loop_config(self) -> LoopConfig:
        """Per-iteration knobs (model, event surface, limits) for this runtime."""

    def loop_cancel_requested(self) -> bool:
        """Whether the turn should stop before the next iteration."""
        return False

    def loop_stop_processing(self) -> bool:
        """``stop_check`` handed to :func:`process_tool_calls`."""
        return False

    def loop_iteration_prompt(self, assembly: PromptAssembly) -> PromptAssembly:
        """Adjust the prompt assembly for a single iteration (e.g. nudges)."""
        return assembly

    def loop_on_iteration_begin(self, state: AgentState) -> None:
        """Called after the iteration counter is incremented."""

    async def loop_on_llm_usage(self, response: LLMResponse) -> None:
        """Record token usage for a streamed response (metrics)."""

    async def loop_on_no_tool_calls(
        self, state: AgentState, response: LLMResponse
    ) -> AgentState:
        """Decide completion when the model returns no tool calls."""
        return state.mark_completed()

    async def loop_on_tools_processed(
        self,
        state: AgentState,
        response: LLMResponse,
        tool_result: Any,
    ) -> AgentState:
        """React to a completed tool batch (artifacts, metrics, loop guard)."""
        return state

    async def loop_on_task_complete(self, state: AgentState) -> AgentState | None:
        """Return a terminal state when a completion signal fired, else None."""
        return None


class AgentLoop:
    """Drive the ReAct loop for one runtime, delegating divergences to a policy."""

    def __init__(
        self,
        *,
        client: AnthropicClient,
        emitter: EventEmitter,
        executor: ToolExecutor,
        compaction_step: CompactionStep,
        skill_controller: SkillActivationController,
        policy: LoopPolicy,
    ) -> None:
        self._client = client
        self._emitter = emitter
        self._executor = executor
        self._compaction_step = compaction_step
        self._skill_controller = skill_controller
        self._policy = policy
        # Per-turn scratch for a skill activation requested mid-iteration. Safe
        # as instance state because each runtime owns one AgentLoop and serializes
        # run_turn (run-lock or single-shot task); it is reset at run_turn entry.
        self._pending_mid_turn_update: Any | None = None
        # Per-turn count of max_tokens recoveries (same lifecycle as above).
        self._max_tokens_recoveries = 0

    async def run_turn(
        self,
        *,
        state: AgentState,
        prompt_assembly: PromptAssembly,
        tools: list[dict[str, Any]],
        cache_prompt: bool,
    ) -> AgentState:
        """Run the ReAct loop to completion and return the terminal state."""
        self._pending_mid_turn_update = None
        self._max_tokens_recoveries = 0
        while not state.completed and state.error is None:
            if self._policy.loop_cancel_requested():
                break
            state = state.increment_iteration()
            self._policy.loop_on_iteration_begin(state)
            iter_assembly = self._policy.loop_iteration_prompt(prompt_assembly)
            state = await self._run_iteration(
                state,
                tools,
                iter_assembly.system_with_cache_control(cache_prompt),
                iter_assembly.rendered,
                cache_prompt,
            )

            update = self._pending_mid_turn_update
            self._pending_mid_turn_update = None
            if update is None:
                try:
                    update = await self._skill_controller.check_mid_turn_from_messages(
                        list(state.messages),
                        cache_prompt=cache_prompt,
                    )
                except Exception as exc:
                    logger.exception("mid_turn_skill_check_failed")
                    return state.mark_error(f"Mid-turn skill activation failed: {exc}")
            if update is not None:
                prompt_assembly = update.prompt_assembly
                tools = update.tools
        return state

    async def _run_iteration(
        self,
        state: AgentState,
        tools: list[dict[str, Any]],
        system_prompt: SystemPrompt,
        system_prompt_text: str,
        cache_prompt: bool,
    ) -> AgentState:
        config = self._policy.loop_config

        if config.validate_message_chain:
            for warning in collect_message_chain_warnings(state.messages):
                logger.warning("message_chain_warning detail={}", warning)

        compacted, did_compact = await self._compaction_step.maybe_compact(
            state.messages,
            system_prompt_text,
            iteration=state.iteration,
        )
        if did_compact:
            logger.debug("compacting_message_history")
            state = replace(state, messages=compacted)

        logger.info("iteration={}/{}", state.iteration, config.max_iterations)

        if config.emit_iteration_start:
            await self._emitter.emit(
                EventType.ITERATION_START,
                {"iteration": state.iteration},
                iteration=state.iteration,
            )

        if state.iteration > config.max_iterations:
            logger.warning("max_iterations_exceeded limit={}", config.max_iterations)
            return state.mark_error(
                f"Exceeded maximum iterations ({config.max_iterations})",
            )

        response, llm_error = await self._stream_llm(state, tools, system_prompt)
        if llm_error is not None:
            return state.mark_error(llm_error)

        await self._policy.loop_on_llm_usage(response)
        if config.emit_llm_response:
            await self._emit_llm_response(state, response)

        state = apply_response_to_state(state, response)

        if response.stop_reason == _STOP_REASON_MAX_TOKENS:
            recovered = self._recover_from_max_tokens(state, response)
            if recovered is not None:
                return recovered

        if not response.tool_calls:
            return await self._policy.loop_on_no_tool_calls(state, response)

        async def _post_tool_callback(tc: Any, result: Any) -> None:
            if not result.success:
                return
            skill_name = self._skill_controller.requested_skill_name(tc.name, tc.input)
            if skill_name is None:
                return
            updated = await self._skill_controller.apply_mid_turn(
                skill_name,
                tool_id=tc.id,
                messages=list(state.messages),
                cache_prompt=cache_prompt,
            )
            if updated is not None:
                self._pending_mid_turn_update = updated

        try:
            tool_result = await process_tool_calls(
                state=state,
                tool_calls=response.tool_calls,
                executor=self._executor,
                emitter=self._emitter,
                agent_id=config.agent_id,
                stop_check=self._policy.loop_stop_processing,
                cancel_check=self._policy.loop_cancel_requested,
                post_tool_callback=_post_tool_callback,
            )
        except Exception as exc:
            logger.exception("tool_processing_failed")
            # Answer every tool_use so the history stays provider-valid;
            # results of calls that ran before the failure are lost with it.
            state = state.add_message(
                build_error_tool_results_message(
                    response.tool_calls,
                    f"Tool execution failed: {exc}",
                )
            )
            return state.mark_error(str(exc))

        state = tool_result.state
        state = await self._policy.loop_on_tools_processed(state, response, tool_result)

        completed = await self._policy.loop_on_task_complete(state)
        if completed is not None:
            return completed
        return state

    def _recover_from_max_tokens(
        self,
        state: AgentState,
        response: LLMResponse,
    ) -> AgentState | None:
        """Handle a response cut off at ``max_tokens``.

        Tool calls from a truncated response may carry truncated input, so they
        are answered with error results instead of being executed. A text-only
        response gets a bounded number of "continue" nudges. Returns None when
        the caller should fall through to the normal completion path.
        """
        within_budget = self._max_tokens_recoveries < MAX_TOKENS_RECOVERIES_PER_TURN
        if response.tool_calls:
            self._max_tokens_recoveries += 1
            logger.warning(
                "max_tokens_truncated_tool_calls count={} recoveries={}",
                len(response.tool_calls),
                self._max_tokens_recoveries,
            )
            state = state.add_message(
                build_error_tool_results_message(
                    response.tool_calls, MAX_TOKENS_TOOL_RESULT
                )
            )
            if within_budget:
                return state
            return state.mark_error(
                "Model output was repeatedly truncated at the output token limit"
            )

        if not within_budget:
            return None
        self._max_tokens_recoveries += 1
        logger.warning(
            "max_tokens_continuation recoveries={}", self._max_tokens_recoveries
        )
        return state.add_message(
            {"role": "user", "content": MAX_TOKENS_CONTINUE_PROMPT}
        )

    async def _stream_llm(
        self,
        state: AgentState,
        tools: list[dict[str, Any]],
        system_prompt: SystemPrompt,
    ) -> tuple[LLMResponse | None, str | None]:
        config = self._policy.loop_config
        messages, repair_warnings = repair_message_chain(state.messages)
        for warning in repair_warnings:
            logger.warning("message_chain_repaired detail={}", warning)
        llm_model = config.model or getattr(self._client, "default_model", "<unknown>")
        debug_logging = config.debug_logging
        thinking_emitted = False

        async def _on_text_delta(delta: str) -> None:
            payload: dict[str, Any] = {"delta": delta}
            if config.agent_id is not None:
                payload["agent_id"] = config.agent_id
            await self._emitter.emit(
                EventType.TEXT_DELTA, payload, iteration=state.iteration
            )

        async def _on_thinking_ready(thinking: str) -> None:
            nonlocal thinking_emitted
            if not thinking:
                return
            thinking_emitted = True
            await self._emitter.emit(
                EventType.THINKING,
                {"thinking": thinking},
                iteration=state.iteration,
            )

        stream_kwargs: dict[str, Any] = {
            "system": system_prompt,
            "messages": list(messages),
            "tools": tools if tools else None,
            "on_text_delta": _on_text_delta,
        }
        if config.model is not None:
            stream_kwargs["model"] = config.model
        if config.emit_thinking:
            stream_kwargs["thinking_budget"] = config.thinking_budget

        if debug_logging:
            logger.debug(
                "{}_llm_call model={} iteration={} messages={} tools={}",
                config.debug_label,
                llm_model,
                state.iteration,
                len(state.messages),
                len(tools),
            )

        try:
            if config.emit_thinking:
                try:
                    response = await self._client.create_message_stream(
                        **stream_kwargs,
                        on_thinking_ready=_on_thinking_ready,
                    )
                except TypeError as exc:
                    if "on_thinking_ready" not in str(exc):
                        raise
                    response = await self._client.create_message_stream(**stream_kwargs)
            else:
                response = await self._client.create_message_stream(**stream_kwargs)
        except Exception as exc:
            if debug_logging:
                logger.debug(
                    "{}_llm_exception model={} iteration={} error_type={}",
                    config.debug_label,
                    llm_model,
                    state.iteration,
                    type(exc).__name__,
                )
            logger.error("llm_call_failed model={} error={}", llm_model, exc)
            return None, format_llm_failure(exc)

        if config.emit_thinking and response.thinking and not thinking_emitted:
            await self._emitter.emit(
                EventType.THINKING,
                {"thinking": response.thinking},
                iteration=state.iteration,
            )

        return response, None

    async def _emit_llm_response(
        self,
        state: AgentState,
        response: LLMResponse,
    ) -> None:
        logger.info(
            "llm_response model={} stop_reason={} tool_calls={} "
            "input_tokens={} output_tokens={}",
            self._policy.loop_config.model
            or getattr(self._client, "default_model", "<unknown>"),
            response.stop_reason,
            len(response.tool_calls),
            response.usage.input_tokens,
            response.usage.output_tokens,
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
