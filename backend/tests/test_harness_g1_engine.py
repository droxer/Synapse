"""AgentLoop harness robustness: tool exceptions, chain repair, max_tokens."""

from __future__ import annotations

from dataclasses import dataclass
from types import SimpleNamespace
from typing import Any

import pytest

from agent.llm.client import LLMResponse, TokenUsage, ToolCall
from agent.runtime.engine import AgentLoop, LoopConfig, LoopPolicy
from agent.runtime.message_chain import collect_message_chain_warnings
from agent.runtime.orchestrator import AgentState
from agent.runtime.prompting import PromptAssembly
from agent.tools.base import ToolResult
from api.events import EventEmitter


@pytest.fixture(autouse=True)
def _settings(monkeypatch) -> None:
    monkeypatch.setattr(
        "agent.runtime.helpers.get_settings",
        lambda: SimpleNamespace(PARALLEL_SAFE_TOOLS_ENABLED=False),
    )


def _usage() -> TokenUsage:
    return TokenUsage(input_tokens=1, output_tokens=1)


def _resp(
    text: str = "",
    tool_calls: tuple[ToolCall, ...] = (),
    stop_reason: str = "end_turn",
) -> LLMResponse:
    return LLMResponse(
        text=text, tool_calls=tool_calls, stop_reason=stop_reason, usage=_usage()
    )


class _RecordingClient:
    default_model = "test-model"

    def __init__(self, *responses: LLMResponse) -> None:
        self._responses = list(responses)
        self.message_snapshots: list[list[dict[str, Any]]] = []

    async def create_message_stream(self, **kwargs: Any) -> LLMResponse:
        self.message_snapshots.append(list(kwargs["messages"]))
        return self._responses.pop(0)


class _Executor:
    def __init__(self, raise_exc: Exception | None = None) -> None:
        self._raise = raise_exc
        self.calls: list[str] = []

    async def execute(self, name: str, tool_input: dict[str, Any]) -> ToolResult:
        self.calls.append(name)
        if self._raise is not None:
            raise self._raise
        return ToolResult.ok(f"{name} done")


class _NoCompaction:
    async def maybe_compact(self, messages, prompt, *, iteration=None):
        return messages, False


class _SkillController:
    def __init__(self, raise_exc: Exception | None = None) -> None:
        self._raise = raise_exc

    def requested_skill_name(self, name: str, tool_input: dict[str, Any]) -> None:
        return None

    async def check_mid_turn_from_messages(self, messages, *, cache_prompt):
        if self._raise is not None:
            raise self._raise
        return None


@dataclass
class _Policy(LoopPolicy):
    max_iterations: int = 10

    @property
    def loop_config(self) -> LoopConfig:
        return LoopConfig(max_iterations=self.max_iterations)


def _loop(
    client: _RecordingClient,
    executor: _Executor | None = None,
    skill_controller: _SkillController | None = None,
) -> AgentLoop:
    return AgentLoop(
        client=client,  # type: ignore[arg-type]
        emitter=EventEmitter(),
        executor=executor or _Executor(),  # type: ignore[arg-type]
        compaction_step=_NoCompaction(),  # type: ignore[arg-type]
        skill_controller=skill_controller or _SkillController(),  # type: ignore[arg-type]
        policy=_Policy(),
    )


async def _run(loop: AgentLoop, state: AgentState) -> AgentState:
    return await loop.run_turn(
        state=state,
        prompt_assembly=PromptAssembly.from_system("sys"),
        tools=[],
        cache_prompt=False,
    )


def _start() -> AgentState:
    return AgentState().add_message({"role": "user", "content": "go"})


# --- Defect 1: tool processing exceptions leave a valid chain ------------


async def test_tool_processing_exception_appends_error_tool_results() -> None:
    client = _RecordingClient(
        _resp(
            tool_calls=(
                ToolCall(id="c1", name="shell", input={}),
                ToolCall(id="c2", name="shell", input={}),
            ),
            stop_reason="tool_use",
        )
    )
    loop = _loop(client, executor=_Executor(raise_exc=RuntimeError("boom")))

    state = await _run(loop, _start())

    assert state.error is not None and "boom" in state.error
    assert collect_message_chain_warnings(state.messages) == []
    last = state.messages[-1]
    assert last["role"] == "user"
    ids = [b["tool_use_id"] for b in last["content"]]
    assert ids == ["c1", "c2"]
    assert all(b.get("is_error") for b in last["content"])


async def test_mid_turn_skill_check_exception_becomes_error_state() -> None:
    client = _RecordingClient(_resp(text="hello"))
    loop = _loop(client, skill_controller=_SkillController(RuntimeError("skill x")))

    state = await _run(loop, _start())

    assert state.error is not None and "skill x" in state.error


# --- Defect 2: chain repaired right before every LLM call ----------------


async def test_llm_receives_repaired_message_chain() -> None:
    broken = (
        AgentState()
        .add_message({"role": "user", "content": "hi"})
        .add_message(
            {
                "role": "assistant",
                "content": [
                    {"type": "tool_use", "id": "old", "name": "x", "input": {}}
                ],
            }
        )
        .add_message({"role": "user", "content": "next"})
    )
    client = _RecordingClient(_resp(text="ok"))

    await _run(_loop(client), broken)

    sent = client.message_snapshots[0]
    assert collect_message_chain_warnings(tuple(sent)) == []
    assert any(
        b.get("type") == "tool_result" and b.get("tool_use_id") == "old"
        for b in sent[-1]["content"]
    )


# --- Defect 4: stop_reason == max_tokens --------------------------------


async def test_max_tokens_with_tool_calls_does_not_execute_tools() -> None:
    executor = _Executor()
    client = _RecordingClient(
        _resp(
            tool_calls=(ToolCall(id="c1", name="file_write", input={"path": "a"}),),
            stop_reason="max_tokens",
        ),
        _resp(text="all done"),
    )

    state = await _run(_loop(client, executor=executor), _start())

    assert executor.calls == []
    assert state.completed is True
    second = client.message_snapshots[1]
    assert collect_message_chain_warnings(tuple(second)) == []
    result_block = second[-1]["content"][0]
    assert result_block["tool_use_id"] == "c1"
    assert result_block["is_error"] is True
    assert "truncat" in str(result_block["content"]).lower()


async def test_max_tokens_without_tool_calls_nudges_to_continue() -> None:
    client = _RecordingClient(
        _resp(text="part one ", stop_reason="max_tokens"),
        _resp(text="part two"),
    )

    state = await _run(_loop(client), _start())

    assert state.completed is True
    assert len(client.message_snapshots) == 2
    second = client.message_snapshots[1]
    assert second[-1]["role"] == "user"
    assert "continue" in str(second[-1]["content"]).lower()


async def test_max_tokens_continuations_are_bounded() -> None:
    client = _RecordingClient(
        _resp(text="a", stop_reason="max_tokens"),
        _resp(text="b", stop_reason="max_tokens"),
        _resp(text="c", stop_reason="max_tokens"),
        _resp(text="d", stop_reason="max_tokens"),
    )

    state = await _run(_loop(client), _start())

    assert state.completed is True
    # 1 initial call + at most 2 continuations
    assert len(client.message_snapshots) == 3


async def test_max_tokens_continuation_text_is_joined_in_final_text() -> None:
    from agent.runtime.helpers import extract_final_text

    client = _RecordingClient(
        _resp(text="part one ", stop_reason="max_tokens"),
        _resp(text="part two"),
    )

    state = await _run(_loop(client), _start())

    assert extract_final_text(state) == "part one part two"


@pytest.mark.parametrize("stop_reason", ["end_turn", "tool_use"])
async def test_normal_stop_reasons_unchanged(stop_reason: str) -> None:
    executor = _Executor()
    client = _RecordingClient(
        _resp(
            tool_calls=(ToolCall(id="c1", name="shell", input={}),),
            stop_reason=stop_reason,
        ),
        _resp(text="fin"),
    )

    state = await _run(_loop(client, executor=executor), _start())

    assert executor.calls == ["shell"]
    assert state.completed is True
