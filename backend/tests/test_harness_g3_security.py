"""Regressions for the security and resource findings in the harness review."""

from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock

import pytest

from agent.sandbox.base import SandboxConfig
from agent.sandbox.e2b_pool import SandboxPool
from agent.sandbox.e2b_provider import E2BSession
from agent.tools.base import (
    ExecutionContext,
    LocalTool,
    SandboxTool,
    ToolDefinition,
    ToolResult,
)
from agent.tools.executor import ToolExecutor
from agent.tools.local.background_tasks import BackgroundTaskManager
from agent.tools.local.web_fetch import _is_private_ip
from agent.tools.meta.planner_state import PlannerState
from agent.tools.registry import ToolRegistry


@pytest.mark.parametrize(
    "address",
    [
        "::ffff:169.254.169.254",
        "0.0.0.0",
        "fc00::1",
        "fe80::1",
        "100.64.1.1",
        "224.0.0.1",
    ],
)
def test_fetch_rejects_nonpublic_addresses(address):
    assert _is_private_ip(address)


@pytest.mark.asyncio
async def test_unowned_sandbox_is_destroyed_instead_of_pooled():
    sandbox = MagicMock(sandbox_id="one-users-files")
    session = E2BSession(sandbox, SandboxConfig(template="default"))
    pool = SandboxPool("test-key")
    await pool.release(session)
    assert await pool.acquire(SandboxConfig(template="default")) is None
    sandbox.kill.assert_called_once()


def test_replanning_does_not_reset_spawn_limit_or_wait_tracking():
    state = PlannerState()
    state.configure_spawn_policy(
        execution_shape="orchestrator_workers", max_worker_spawns=1
    )
    state.register_steps([{"name": "first"}])
    state.record_spawn("first", "worker-1")
    state.record_wait(["worker-1"])
    state.register_steps([{"name": "second"}])
    assert state.validate_new_spawn() is not None
    assert state.waited_agent_count == 1


class _OutputTool(LocalTool):
    def definition(self):
        return ToolDefinition(
            "output", "output", {"type": "object"}, ExecutionContext.LOCAL
        )

    async def execute(self, **kwargs):
        return ToolResult.ok("x" * 1_000_000)


@pytest.mark.asyncio
async def test_executor_bounds_successful_tool_output():
    result = await ToolExecutor(ToolRegistry().register(_OutputTool())).execute(
        "output", {}
    )
    assert result.success
    assert len(result.output) <= 50_000
    assert result.metadata["output_truncated"]


class _SideEffectTool(SandboxTool):
    def definition(self):
        return ToolDefinition(
            "write", "write", {"type": "object"}, ExecutionContext.SANDBOX
        )

    async def execute(self, session, **kwargs):
        return ToolResult.ok(
            "file saved", {"artifact_paths": ["/workspace/report.txt"]}
        )


@pytest.mark.asyncio
async def test_artifact_failure_keeps_successful_side_effect_successful():
    provider = SimpleNamespace(create_session=AsyncMock(return_value=object()))
    artifacts = SimpleNamespace(
        extract_from_sandbox=AsyncMock(side_effect=RuntimeError("storage unavailable"))
    )
    executor = ToolExecutor(
        ToolRegistry().register(_SideEffectTool()),
        sandbox_provider=provider,
        artifact_manager=artifacts,
    )
    result = await executor.execute("write", {})
    assert result.success
    assert result.output == "file saved"
    assert result.metadata["artifact_extraction_error"]


@pytest.mark.asyncio
async def test_background_manager_shutdown_cancels_pending_notifications():
    emitter = SimpleNamespace(emit=AsyncMock())
    manager = BackgroundTaskManager(emitter)
    record = await manager.schedule_notification(
        title="later", message="hello", delay_seconds=3600
    )
    await manager.cancel_all()
    assert record.status == "cancelled"
    assert record.asyncio_task.done()
    emitter.emit.assert_not_called()


@pytest.mark.asyncio
async def test_mid_turn_unrestricted_skill_cannot_widen_existing_permissions(
    monkeypatch,
):
    from agent.runtime.prompting import PromptAssembly
    from agent.runtime.skill_activation import SkillActivationController
    from agent.skills.loader import SkillRegistry
    from agent.skills.models import SkillContent, SkillMetadata
    from agent.tools.local.activate_skill import ActivateSkill
    from api.events import EventEmitter

    skills = SkillRegistry(
        (
            SkillContent(
                metadata=SkillMetadata(name="open", description="Unrestricted"),
                instructions="Use tools",
                directory_path=Path("/tmp/open"),
                source_type="bundled",
            ),
        )
    )
    registry = (
        ToolRegistry()
        .register(_OutputTool())
        .register(_SideEffectTool())
        .register(ActivateSkill(skills))
    )
    executor = ToolExecutor(registry)
    executor.set_allowed_tools({"output", "activate_skill"}, set())
    controller = SkillActivationController(
        skill_registry=skills,
        executor=executor,
        emitter=EventEmitter(),
        client=object(),
        install_context="test",
    )
    controller.begin_turn(
        prompt_assembly=PromptAssembly.from_system("test"), registry=registry
    )
    monkeypatch.setattr(
        "agent.runtime.skill_activation.prepare_skill_for_turn", AsyncMock()
    )
    update = await controller.apply_mid_turn(
        "open", tool_id="activation", messages=[], cache_prompt=False
    )
    assert "write" not in [tool["name"] for tool in update.tools]
    result = await executor.execute("write", {})
    assert not result.success
    assert "not allowed" in result.error


@pytest.mark.asyncio
async def test_tool_deadline_and_requested_timeout_have_upper_bounds(monkeypatch):
    from agent.tools import executor as module

    class SlowTool(_OutputTool):
        async def execute(self, **kwargs):
            import asyncio

            await asyncio.sleep(10)

    monkeypatch.setattr(module, "MAX_TOOL_TIMEOUT_SECONDS", 0.01)
    result = await ToolExecutor(ToolRegistry().register(SlowTool())).execute(
        "output", {}
    )
    assert not result.success
    assert "Side effects may have occurred" in result.error


@pytest.mark.asyncio
@pytest.mark.parametrize("tags", [("meta", "agent"), ("communication",)])
async def test_worker_waits_and_user_prompts_are_exempt_from_tool_deadline(
    monkeypatch, tags
):
    import asyncio

    from agent.tools import executor as module

    class WaitingTool(LocalTool):
        def definition(self):
            return ToolDefinition(
                "wait", "wait", {"type": "object"}, ExecutionContext.LOCAL, tags=tags
            )

        async def execute(self, **kwargs):
            await asyncio.sleep(0.05)
            return ToolResult.ok("observed")

    monkeypatch.setattr(module, "MAX_TOOL_TIMEOUT_SECONDS", 0.01)
    result = await ToolExecutor(ToolRegistry().register(WaitingTool())).execute(
        "wait", {}
    )
    assert result.success, result.error
    assert result.output == "observed"


@pytest.mark.asyncio
async def test_e2b_renews_lease_before_command_and_rejects_expiry_before_execution():
    from agent.sandbox.base import ExecResult

    sandbox = MagicMock()
    sandbox.commands.run.return_value = ExecResult("ok", "", 0)
    session = E2BSession(sandbox)
    assert (await session.exec("true", timeout=10_000)).success
    sandbox.set_timeout.assert_called_once_with(360)
    assert sandbox.commands.run.call_args.kwargs["timeout"] == 300
    expired = type("NotFoundException", (Exception,), {})
    sandbox.set_timeout.side_effect = expired("gone")
    sandbox.commands.run.reset_mock()
    with pytest.raises(RuntimeError, match="expired before execution"):
        await session.exec("side effect")
    sandbox.commands.run.assert_not_called()


@pytest.mark.asyncio
async def test_e2b_renewal_never_shortens_a_longer_configured_lifetime():
    from agent.sandbox.base import ExecResult

    sandbox = MagicMock()
    sandbox.commands.run.return_value = ExecResult("ok", "", 0)
    session = E2BSession(
        sandbox, config=SandboxConfig(template="default", timeout=3600)
    )
    await session.exec("true", timeout=30)
    sandbox.set_timeout.assert_called_once_with(3600)


@pytest.mark.asyncio
async def test_upload_spool_survives_retry_and_is_removed_at_runtime_cleanup(tmp_path):
    from agent.runtime.turn_attachments import upload_attachments_to_sandbox
    from agent.sandbox.base import ExecResult

    spool = tmp_path / "attachment-spool.csv"
    spool.write_bytes(b"column\nvalue")
    session = SimpleNamespace(
        exec=AsyncMock(return_value=ExecResult("", "", 0)), upload_file=AsyncMock()
    )
    provider = SimpleNamespace(
        create_session=AsyncMock(return_value=session), destroy_session=AsyncMock()
    )
    executor = ToolExecutor(ToolRegistry(), sandbox_provider=provider)
    attachment = SimpleNamespace(
        filename="report.csv",
        size=12,
        data=b"",
        content_type="text/csv",
        local_path=str(spool),
    )
    await upload_attachments_to_sandbox(executor, (attachment,))
    assert spool.exists()
    await upload_attachments_to_sandbox(executor, (attachment,))
    assert session.upload_file.await_count == 2
    await executor.cleanup()
    assert not spool.exists()
