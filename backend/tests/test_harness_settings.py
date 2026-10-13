"""Core settings: defaults for library use, app Settings when installed."""

from __future__ import annotations

import ast
from collections.abc import Iterator
from dataclasses import asdict, fields
from pathlib import Path

import pytest

import agent.config
import config.settings
from agent.config import HarnessSettings, configure_settings, get_settings
from agent.context.profiles import resolve_compaction_profile
from config.settings import Settings

AGENT_DIR = Path(__file__).resolve().parents[1] / "agent"
_HARNESS_FIELDS = {f.name for f in fields(HarnessSettings)}
# These literal reads intentionally use compaction-owned fallbacks. Their
# values are covered by the resolved-profile comparisons below.
_OPTIONAL_WITH_CORE_FALLBACK = {
    "COMPACT_FALLBACK_PREVIEW_CHARS",
    "COMPACT_FALLBACK_RESULT_CHARS",
}
# Dynamic field names are allowed only at these existing profile accesses.
# New dynamic accesses must add explicit behavioral coverage before approval.
_DYNAMIC_PROFILE_READS = {
    ("context/profiles.py", "f'COMPACT_{prefix}_{suffix}'"),
    ("context/profiles.py", "f'COMPACT_{suffix}'"),
}


def _is_settings_source(node: ast.expr) -> bool:
    if isinstance(node, ast.Name):
        return node.id.endswith("settings")
    if isinstance(node, ast.Attribute):
        return node.attr.endswith("settings")
    return (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "get_settings"
    )


def _settings_reads(source: str) -> tuple[set[str], set[str], set[str]]:
    """Classify literal reads; retain dynamic names for explicit review.

    Settings sources use the existing settings/*_settings/get_settings()
    naming convention. This is a syntax guard, not alias/data-flow analysis.
    """
    required: set[str] = set()
    optional: set[str] = set()
    dynamic: set[str] = set()
    for node in ast.walk(ast.parse(source)):
        if (
            isinstance(node, ast.Attribute)
            and _is_settings_source(node.value)
            and node.attr.isupper()
        ):
            required.add(node.attr)
        elif (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Name)
            and node.func.id == "getattr"
            and len(node.args) >= 2
            and _is_settings_source(node.args[0])
        ):
            name = node.args[1]
            if isinstance(name, ast.Constant) and isinstance(name.value, str):
                if name.value.isupper():
                    target = optional if len(node.args) == 3 else required
                    target.add(name.value)
            else:
                dynamic.add(ast.unparse(name))
    return required, optional, dynamic


@pytest.fixture
def library_mode() -> Iterator[None]:
    previous = configure_settings(HarnessSettings)
    yield
    configure_settings(previous)


def test_defaults_need_no_environment(
    library_mode: None, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)

    settings = get_settings()

    assert isinstance(settings, HarnessSettings)
    assert settings.LITE_MODEL == "claude-haiku-4-5-20251001"


def test_configured_provider_is_consulted_on_every_call(library_mode: None) -> None:
    values = iter([HarnessSettings(LITE_MODEL="a"), HarnessSettings(LITE_MODEL="b")])
    configure_settings(lambda: next(values))

    assert get_settings().LITE_MODEL == "a"
    assert get_settings().LITE_MODEL == "b"


def test_app_install_is_late_bound(monkeypatch: pytest.MonkeyPatch) -> None:
    # tests/conftest.py ran install_harness_settings(), as api.main does.
    sentinel = HarnessSettings(LITE_MODEL="patched")
    monkeypatch.setattr(config.settings, "get_settings", lambda: sentinel)

    assert agent.config.get_settings() is sentinel


def test_every_harness_default_matches_the_app_default() -> None:
    defaults = HarnessSettings()
    for name in sorted(_HARNESS_FIELDS):
        assert name in Settings.model_fields, f"{name} missing from app Settings"
        assert Settings.model_fields[name].default == getattr(defaults, name), name


def test_every_settings_field_the_core_reads_has_a_harness_default() -> None:
    required: set[str] = set()
    optional: set[str] = set()
    dynamic: set[tuple[str, str]] = set()
    for path in AGENT_DIR.rglob("*.py"):
        direct, fallback, computed = _settings_reads(path.read_text(encoding="utf-8"))
        required.update(direct)
        optional.update(fallback)
        dynamic.update(
            (path.relative_to(AGENT_DIR).as_posix(), name) for name in computed
        )

    assert required - _HARNESS_FIELDS == set(), sorted(required - _HARNESS_FIELDS)
    uncovered = optional - _HARNESS_FIELDS - _OPTIONAL_WITH_CORE_FALLBACK
    assert uncovered == set(), sorted(uncovered)
    assert dynamic == _DYNAMIC_PROFILE_READS


def test_settings_scanner_handles_quotes_whitespace_and_required_reads() -> None:
    samples = [
        ("settings.NEW_FIELD", {"NEW_FIELD"}, set()),
        ("self._settings.NEW_FIELD", {"NEW_FIELD"}, set()),
        ("get_settings().NEW_FIELD", {"NEW_FIELD"}, set()),
        ("getattr(settings, 'NEW_FIELD')", {"NEW_FIELD"}, set()),
        ("getattr(settings, 'NEW_FIELD', 1)", set(), {"NEW_FIELD"}),
        ('getattr(\n    settings,\n    "NEW_FIELD",\n    1,\n)', set(), {"NEW_FIELD"}),
        ("getattr(get_settings(), 'NEW_FIELD')", {"NEW_FIELD"}, set()),
    ]
    for source, required, optional in samples:
        assert _settings_reads(source) == (required, optional, set()), source
    assert _settings_reads('getattr(settings, f"COMPACT_{suffix}", None)') == (
        set(),
        set(),
        {"f'COMPACT_{suffix}'"},
    )


@pytest.mark.parametrize(
    "runtime", ["web_conversation", "channel_conversation", "planner", "task_agent"]
)
def test_compaction_defaults_match_the_app_for_every_runtime(runtime: str) -> None:
    # Construct declared defaults without .env, credentials, or validators;
    # get_settings()/Settings() would make this test environment-dependent.
    app_defaults = Settings.model_construct()
    library_profile = asdict(resolve_compaction_profile(HarnessSettings(), runtime))
    app_profile = asdict(resolve_compaction_profile(app_defaults, runtime))

    for name, value in app_profile.items():
        assert library_profile[name] == value, f"{runtime}.{name}"
