"""The agent core must import and run without the Synapse app layers.

Both checks run in a fresh interpreter, from an empty directory (so no
``.env`` is picked up), with provider credentials removed from the
environment — the situation of a third party using the harness as a library.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
_APP_ONLY_PACKAGES = ("api", "config", "fastapi", "starlette", "pydantic_settings")
_CREDENTIAL_VARS = ("ANTHROPIC_API_KEY", "TAVILY_API_KEY", "EXA_API_KEY")
_SUBPROCESS_TIMEOUT_SECONDS = 120

_PENDING = pytest.mark.xfail(
    strict=True,
    reason="core still imports api/config; removed by the core-boundary plan, Task 4",
)

_IMPORT_EVERY_CORE_MODULE = f"""
    import importlib, json, pkgutil, sys
    import agent
    for info in pkgutil.walk_packages(agent.__path__, "agent."):
        importlib.import_module(info.name)
    leaked = sorted(m for m in sys.modules if m.split(".")[0] in {_APP_ONLY_PACKAGES!r})
    print(json.dumps(leaked))
"""

_RUN_ONE_TURN = """
    import asyncio, json, sys
    from agent.events import EventEmitter
    from agent.llm.client import LLMResponse, TokenUsage
    from agent.runtime.orchestrator import AgentOrchestrator
    from agent.tools.executor import ToolExecutor
    from agent.tools.registry import ToolRegistry

    class ScriptedClient:
        async def create_message_stream(self, **kwargs):
            return LLMResponse(
                text="All done.",
                tool_calls=(),
                stop_reason="end_turn",
                usage=TokenUsage(input_tokens=10, output_tokens=5),
            )

    async def main():
        emitter = EventEmitter()
        registry = ToolRegistry()
        orchestrator = AgentOrchestrator(
            claude_client=ScriptedClient(),
            tool_registry=registry,
            tool_executor=ToolExecutor(registry=registry, event_emitter=emitter),
            event_emitter=emitter,
            system_prompt="You are a test agent.",
        )
        result = await orchestrator.run("hello")
        leaked = sorted(
            name for name in sys.modules
            if name.split(".")[0] in __APP_ONLY_PACKAGES__
        )
        print(json.dumps({"result": result, "leaked": leaked}))

    asyncio.run(main())
""".replace("__APP_ONLY_PACKAGES__", repr(_APP_ONLY_PACKAGES))


def _run_isolated(script: str, cwd: Path) -> subprocess.CompletedProcess[str]:
    env = {k: v for k, v in os.environ.items() if k not in _CREDENTIAL_VARS}
    env["PYTHONPATH"] = str(BACKEND_DIR)
    return subprocess.run(
        [sys.executable, "-c", textwrap.dedent(script)],
        cwd=cwd,
        env=env,
        capture_output=True,
        text=True,
        timeout=_SUBPROCESS_TIMEOUT_SECONDS,
        check=False,
    )


@_PENDING
def test_core_imports_without_app_layers(tmp_path: Path) -> None:
    proc = _run_isolated(_IMPORT_EVERY_CORE_MODULE, tmp_path)

    assert proc.returncode == 0, proc.stderr
    leaked = json.loads(proc.stdout.strip().splitlines()[-1])
    assert leaked == []


@_PENDING
def test_core_runs_a_turn_without_credentials_or_app(tmp_path: Path) -> None:
    proc = _run_isolated(_RUN_ONE_TURN, tmp_path)

    assert proc.returncode == 0, proc.stderr
    payload = json.loads(proc.stdout.strip().splitlines()[-1])
    assert payload["result"] == "All done."
    assert payload["leaked"] == [], payload["leaked"]
