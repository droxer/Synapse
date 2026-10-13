"""Settings the harness core reads, independent of any host application.

The core never reads environment variables or ``.env`` files. Core code calls
:func:`get_settings`. By default that returns built-in
:class:`HarnessSettings`, so the harness works as a library with no
configuration. A host application calls :func:`configure_settings` once at
startup to supply its own settings object, which must expose at least every
field of :class:`HarnessSettings`. Synapse installs its env-driven ``Settings``
via ``config.settings.install_harness_settings()``.
"""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Literal, cast

TokenCounterStrategy = Literal["weighted", "legacy"]


@dataclass(frozen=True)
class HarnessSettings:
    """Defaults for every setting the core reads (names match the app's env vars)."""

    # Models and provider endpoint
    PLANNING_MODEL: str = "claude-sonnet-4-6"
    TASK_MODEL: str = "claude-sonnet-4-6"
    LITE_MODEL: str = "claude-haiku-4-5-20251001"
    SKILL_SELECTOR_MODEL: str = ""
    ANTHROPIC_BASE_URL: str = "https://api.anthropic.com"
    PROMPT_CACHE_ENABLED: bool = False

    # Loop and tool guardrails
    AGENT_TIMEOUT_SECONDS: int = 300
    AGENT_GLOBAL_TOKEN_BUDGET: int = 0
    MAX_SHELL_TOOLS_PER_TURN: int = 100
    PARALLEL_SAFE_TOOLS_ENABLED: bool = True
    STUCK_LOOP_TOOL_REPEAT_THRESHOLD: int = 3
    HANDOFF_MESSAGE_SNIPPET_CHARS: int = 2000
    EXECUTION_SHAPE_PARALLEL_SOFT_LIMIT: int = 3
    EXECUTION_SHAPE_ORCHESTRATOR_WORKERS_SOFT_LIMIT: int = 4
    VALIDATE_AGENT_MESSAGE_CHAIN: bool = False
    AGENT_DEBUG_LOGGING: bool = False

    # Context compaction. Other COMPACT_* values and per-runtime
    # COMPACT_<KIND>_* overrides are optional; agent.context.profiles falls back
    # to its own defaults when a host omits them.
    COMPACT_TOKEN_COUNTER: TokenCounterStrategy = "weighted"

    # Memory
    INITIAL_CONVERSATION_MEMORY_LIMIT: int = 20
    MEMORY_FACT_CONFIDENCE_THRESHOLD: float = 0.85
    MEMORY_FACT_PROMPT_TOKEN_CAP: int = 1200
    MEMORY_FACT_TOP_K: int = 8
    MEMORY_PROMPT_ENTRY_MAX_CHARS: int = 300
    MEMORY_PROMPT_MAX_CHARS: int = 4000

    # Skills
    SKILLS_ENABLED: bool = True
    SKILL_DEPENDENCY_INSTALL_STRICT: bool = False

    # Storage and database adapters
    STORAGE_PROVIDER: str = "local"
    STORAGE_DIR: str = "./artifacts"
    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_PUBLIC_URL: str = ""
    DB_POOL_SIZE: int = 10
    DB_MAX_OVERFLOW: int = 20
    DB_POOL_TIMEOUT: int = 30


SettingsProvider = Callable[[], object]

_DEFAULT_SETTINGS = HarnessSettings()


def _default_settings() -> HarnessSettings:
    return _DEFAULT_SETTINGS


_provider: SettingsProvider = _default_settings


def configure_settings(provider: SettingsProvider) -> SettingsProvider:
    """Install the settings source for the core and return the previous one.

    This is the core's single composition seam for configuration: hosts call
    it once at startup. Tests use the return value to restore the previous
    provider.
    """
    global _provider
    previous = _provider
    _provider = provider
    return previous


def get_settings() -> HarnessSettings:
    """Return the current settings (any object with ``HarnessSettings`` fields)."""
    return cast(HarnessSettings, _provider())
