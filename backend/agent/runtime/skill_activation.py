"""Shared skill-activation controller for agent runtimes.

The single-agent orchestrator, planner, and task-agent runner all need the
same behavior around skills: match a skill at the start of a turn, stage it,
inject its prompt content, optionally restrict the tool registry, and react
to ``activate_skill`` calls mid-turn. This module owns that behavior once so
the three loops do not each re-implement it.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from loguru import logger

from agent.llm.client import AnthropicClient
from agent.runtime.prompting import PromptAssembly
from agent.runtime.skill_install import install_skill_dependencies_for_turn
from agent.runtime.skill_runtime import split_allowed_tools
from agent.runtime.skill_selector import (
    AttachmentDescriptor,
    select_skill_for_message,
)
from agent.runtime.skill_setup import (
    build_skill_prompt_content,
    emit_redundant_skill_activation,
    prepare_skill_for_turn,
    tool_use_had_error_result,
)
from agent.skills.loader import SkillRegistry
from agent.skills.models import SkillContent
from agent.tools.executor import ToolExecutor
from agent.tools.registry import ToolRegistry
from api.events import EventEmitter
from config.settings import get_settings


def _attachment_descriptors(
    attachments: tuple[Any, ...],
) -> tuple[AttachmentDescriptor, ...]:
    """Build skill-selector descriptors from turn attachments."""
    return tuple(
        AttachmentDescriptor(
            filename=str(getattr(attachment, "filename", "") or ""),
            content_type=str(getattr(attachment, "content_type", "") or ""),
        )
        for attachment in attachments
    )


@dataclass(frozen=True)
class SkillActivation:
    """Immutable result of activating (or re-resolving) a skill for a turn.

    Carries the effective prompt assembly, the effective tool registry, and
    the provider-ready tool payload that the loop should use going forward.
    """

    prompt_assembly: PromptAssembly
    registry: ToolRegistry
    tools: list[dict[str, Any]]


class SkillActivationController:
    """Owns turn-start and mid-turn skill activation for one runtime loop.

    A single instance is reused across turns; call :meth:`begin_turn` at the
    start of every turn to reset per-turn state. The controller mutates the
    provided executor (staging, allowed-tool restrictions) and emits skill
    lifecycle events through the shared emitter.
    """

    def __init__(
        self,
        *,
        skill_registry: SkillRegistry | None,
        executor: ToolExecutor,
        emitter: EventEmitter,
        client: AnthropicClient,
        install_context: str,
        preserved_tool_names: tuple[str, ...] = (),
    ) -> None:
        self._skill_registry = skill_registry
        self._executor = executor
        self._emitter = emitter
        self._client = client
        self._install_context = install_context
        self._preserved_tool_names = preserved_tool_names

        self._auto_injected_skill: str | None = None
        self._turn_prompt_assembly: PromptAssembly | None = None
        self._turn_unfiltered_registry: ToolRegistry | None = None
        self._processed_skill_activation_tool_ids: set[str] = set()

    @property
    def auto_injected_skill(self) -> str | None:
        """Return the skill auto-activated for the current turn, if any."""
        return self._auto_injected_skill

    @property
    def enabled(self) -> bool:
        """Return True when a skill registry is wired up."""
        return self._skill_registry is not None

    def begin_turn(
        self,
        *,
        prompt_assembly: PromptAssembly,
        registry: ToolRegistry,
    ) -> None:
        """Reset per-turn state ahead of turn-start matching."""
        self._auto_injected_skill = None
        self._processed_skill_activation_tool_ids = set()
        self._turn_prompt_assembly = prompt_assembly
        self._turn_unfiltered_registry = registry

    async def match_and_activate_turn_start(
        self,
        *,
        user_message: str,
        selected_skills: tuple[str, ...],
        prompt_assembly: PromptAssembly,
        registry: ToolRegistry,
        cache_prompt: bool,
        attachments: tuple[Any, ...] = (),
    ) -> tuple[SkillActivation, SkillContent | None]:
        """Resolve and activate the best skill for the start of a turn.

        Always returns a :class:`SkillActivation` describing the tools/prompt
        the loop should use, plus the matched skill (or ``None``). Raises if a
        matched skill fails to stage so the caller can surface a setup error.
        """
        self._turn_unfiltered_registry = registry
        if self._skill_registry is None:
            return (
                SkillActivation(
                    prompt_assembly=prompt_assembly,
                    registry=registry,
                    tools=registry.to_anthropic_tools(cache_breakpoint=cache_prompt),
                ),
                None,
            )

        settings = get_settings()
        matched = await select_skill_for_message(
            user_message=user_message,
            selected_skills=selected_skills,
            attachment_descriptors=_attachment_descriptors(attachments),
            skill_registry=self._skill_registry,
            client=self._client,
            model=settings.SKILL_SELECTOR_MODEL or settings.LITE_MODEL,
        )
        if matched is None:
            return (
                SkillActivation(
                    prompt_assembly=prompt_assembly,
                    registry=registry,
                    tools=registry.to_anthropic_tools(cache_breakpoint=cache_prompt),
                ),
                None,
            )

        self._auto_injected_skill = matched.metadata.name
        explicit_skill_name = next((s for s in selected_skills if s.strip()), None)
        source = "explicit" if explicit_skill_name is not None else "auto"

        registry = self._replace_activate_skill_tool(registry, matched.metadata.name)
        self._turn_unfiltered_registry = registry

        await prepare_skill_for_turn(
            executor=self._executor,
            skill=matched,
            emitter=self._emitter,
            source=source,
            install_dependencies=lambda: install_skill_dependencies_for_turn(
                self._executor,
                matched.metadata.dependencies,
                self._emitter,
                context=self._install_context,
                skill_name=matched.metadata.name,
                source=source,
                raise_on_error=True,
            ),
        )

        prompt_assembly = prompt_assembly.with_volatile_sections(
            build_skill_prompt_content(matched),
        )
        effective_registry = self._apply_allowed_tools(registry, matched)
        return (
            SkillActivation(
                prompt_assembly=prompt_assembly,
                registry=effective_registry,
                tools=effective_registry.to_anthropic_tools(
                    cache_breakpoint=cache_prompt
                ),
            ),
            matched,
        )

    def requested_skill_name(
        self,
        tool_call_name: str,
        tool_input: dict[str, Any],
    ) -> str | None:
        """Map a tool call to the skill name it would activate, if any."""
        if self._skill_registry is None:
            return None
        if tool_call_name == "activate_skill":
            name = tool_input.get("name")
            return name if isinstance(name, str) and name else None
        if self._skill_registry.find_by_name(tool_call_name) is not None:
            return tool_call_name
        return None

    async def apply_mid_turn(
        self,
        skill_name: str,
        *,
        tool_id: str | None,
        messages: list[dict[str, Any]],
        cache_prompt: bool,
    ) -> SkillActivation | None:
        """Activate *skill_name* mid-turn, returning new prompt/tools or None."""
        if self._skill_registry is None or self._turn_prompt_assembly is None:
            return None

        if tool_id is not None and tool_id in self._processed_skill_activation_tool_ids:
            return None

        if skill_name == self._auto_injected_skill:
            await emit_redundant_skill_activation(
                self._emitter,
                skill_name=skill_name,
                tool_id=tool_id,
                messages=messages,
            )
            if tool_id is not None:
                self._processed_skill_activation_tool_ids.add(tool_id)
            return None

        skill = self._skill_registry.find_by_name(skill_name)
        if skill is None:
            return None

        self._auto_injected_skill = skill.metadata.name
        prompt_assembly = self._turn_prompt_assembly.with_volatile_sections(
            build_skill_prompt_content(skill),
        )

        base_registry = self._turn_unfiltered_registry
        updated_registry = self._replace_activate_skill_tool(
            base_registry, skill.metadata.name
        )

        reset_allowed_tools = getattr(self._executor, "reset_allowed_tools", None)
        if callable(reset_allowed_tools):
            reset_allowed_tools()

        await prepare_skill_for_turn(
            executor=self._executor,
            skill=skill,
            emitter=self._emitter,
            source="mid_turn",
            install_dependencies=lambda: install_skill_dependencies_for_turn(
                self._executor,
                skill.metadata.dependencies,
                self._emitter,
                context=f"{self._install_context}_mid_turn",
                skill_name=skill.metadata.name,
                source="mid_turn",
                raise_on_error=True,
            ),
        )

        updated_registry = self._apply_allowed_tools(updated_registry, skill)
        if tool_id is not None:
            self._processed_skill_activation_tool_ids.add(tool_id)
        logger.info(
            "mid_turn_skill_activated context={} name={}",
            self._install_context,
            skill.metadata.name,
        )
        return SkillActivation(
            prompt_assembly=prompt_assembly,
            registry=updated_registry,
            tools=updated_registry.to_anthropic_tools(cache_breakpoint=cache_prompt),
        )

    async def check_mid_turn_from_messages(
        self,
        messages: list[dict[str, Any]],
        *,
        cache_prompt: bool,
    ) -> SkillActivation | None:
        """Detect an ``activate_skill`` call in the latest assistant message."""
        if self._skill_registry is None:
            return None

        last_assistant = None
        for msg in reversed(messages):
            if msg.get("role") == "assistant":
                last_assistant = msg
                break
        if last_assistant is None:
            return None

        content = last_assistant.get("content")
        if not isinstance(content, list):
            return None

        activated_name, tool_id = self._scan_activation_block(content)
        if not activated_name:
            return None
        if tool_id is not None and tool_id in self._processed_skill_activation_tool_ids:
            return None
        if tool_id is not None and tool_use_had_error_result(messages, tool_id):
            return None

        return await self.apply_mid_turn(
            activated_name,
            tool_id=tool_id,
            messages=messages,
            cache_prompt=cache_prompt,
        )

    def _scan_activation_block(
        self,
        content: list[Any],
    ) -> tuple[str | None, str | None]:
        """Return the (skill_name, tool_id) of the first activation tool_use."""
        assert self._skill_registry is not None
        for block in content:
            if not isinstance(block, dict) or block.get("type") != "tool_use":
                continue
            block_name = block.get("name")
            if block_name == "activate_skill":
                skill_input = block.get("input", {})
                return skill_input.get("name"), block.get("id")
            if (
                isinstance(block_name, str)
                and self._skill_registry.find_by_name(block_name) is not None
            ):
                return block_name, block.get("id")
        return None, None

    def _replace_activate_skill_tool(
        self,
        registry: ToolRegistry,
        active_skill_name: str,
    ) -> ToolRegistry:
        from agent.tools.local.activate_skill import ActivateSkill

        return registry.replace_tool(
            ActivateSkill(
                skill_registry=self._skill_registry,
                active_skill_name=active_skill_name,
            )
        )

    def _apply_allowed_tools(
        self,
        registry: ToolRegistry,
        skill: SkillContent,
    ) -> ToolRegistry:
        """Restrict *registry* and the executor to a skill's allowed tools."""
        if not skill.metadata.allowed_tools:
            return registry
        allowed_names, allowed_tags = split_allowed_tools(
            skill.metadata.allowed_tools,
            preserved_names=self._preserved_tool_names,
        )
        set_allowed_tools = getattr(self._executor, "set_allowed_tools", None)
        if callable(set_allowed_tools):
            set_allowed_tools(allowed_names, allowed_tags)
        return registry.filter_by_names_or_tags(allowed_names, allowed_tags)
