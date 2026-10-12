"""Regression: the shared AgentLoop must keep tool_result messages in state.

Dropping them leaves an assistant ``tool_use`` without a following
``tool_result``, which providers reject with a 400 on the next LLM call.
"""

from types import SimpleNamespace
from typing import Any

from agent.llm.client import LLMResponse, TokenUsage, ToolCall
from agent.runtime.message_chain import collect_message_chain_warnings
from agent.runtime.task_runner import TaskAgentConfig, TaskAgentRunner
from agent.tools.base import ToolResult
from agent.tools.registry import ToolRegistry
from api.events import EventEmitter


def _settings() -> SimpleNamespace:
    return SimpleNamespace(
        COMPACT_FULL_INTERACTIONS=5,
        COMPACT_FULL_DIALOGUE_TURNS=5,
        COMPACT_TOKEN_BUDGET=150_000,
        COMPACT_SUMMARY_MODEL="",
        LITE_MODEL="claude-lite-test",
        TASK_MODEL="claude-task-test",
        SKILL_SELECTOR_MODEL="",
        SKILL_DEPENDENCY_INSTALL_STRICT=False,
        AGENT_TIMEOUT_SECONDS=5.0,
    )


class _RecordingClient:
    def __init__(self, *responses: LLMResponse) -> None:
        self._responses = list(responses)
        self.message_snapshots: list[list[dict[str, Any]]] = []

    async def create_message(self, **kwargs: Any) -> LLMResponse:
        raise RuntimeError("selector unavailable")

    async def create_message_stream(self, **kwargs: Any) -> LLMResponse:
        self.message_snapshots.append(list(kwargs["messages"]))
        return self._responses.pop(0)


class _OkExecutor:
    def canonical_tool_call_event_payload(
        self, tool_name: str, tool_input: dict[str, object]
    ) -> tuple[str, dict[str, object]]:
        return tool_name, tool_input

    async def execute(self, name: str, tool_input: dict[str, object]) -> ToolResult:
        return ToolResult.ok(f"{name} done")


class _NoopObserver:
    def should_compact(
        self, messages: tuple[dict[str, object], ...], system_prompt: str = ""
    ) -> bool:
        return False

    async def compact(
        self,
        messages: tuple[dict[str, object], ...],
        system_prompt: str = "",
    ) -> tuple[dict[str, object], ...]:
        return messages


def _usage() -> TokenUsage:
    return TokenUsage(input_tokens=1, output_tokens=1)


async def test_tool_results_follow_tool_use_on_next_llm_call(monkeypatch):
    monkeypatch.setattr("agent.runtime.task_runner.get_settings", _settings)
    client = _RecordingClient(
        LLMResponse(
            text="",
            tool_calls=(
                ToolCall(id="call_00", name="web_search", input={"q": "ev 2024"}),
                ToolCall(id="call_01", name="web_search", input={"q": "ev sales"}),
            ),
            stop_reason="tool_use",
            usage=_usage(),
        ),
        LLMResponse(text="done", tool_calls=(), stop_reason="end_turn", usage=_usage()),
    )
    runner = TaskAgentRunner(
        agent_id="agent-tool-results",
        config=TaskAgentConfig(task_description="research", name="worker-1"),
        claude_client=client,
        tool_registry=ToolRegistry(),
        tool_executor=_OkExecutor(),
        event_emitter=EventEmitter(),
        observer=_NoopObserver(),
    )

    result = await runner.run()

    assert result.success is True
    second_call = client.message_snapshots[1]
    assert collect_message_chain_warnings(tuple(second_call)) == []
    tool_result_ids = {
        block["tool_use_id"]
        for block in second_call[-1]["content"]
        if block.get("type") == "tool_result"
    }
    assert second_call[-1]["role"] == "user"
    assert tool_result_ids == {"call_00", "call_01"}
