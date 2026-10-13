# Backend directory layout (`backend/`)

## API layer

| Path | Role |
| --- | --- |
| `api/main.py` | FastAPI app factory; shared state (Claude client, sandbox, storage, DB) |
| `api/builders.py` | Runtime builders: system prompt sections, tool registries, sandbox provider selection, orchestrator construction |
| `api/routes/` | HTTP routes: `conversations.py` (turn routing, SSE, reconstruction), `artifacts.py`, `skills.py`, `skill_files.py`, `mcp.py`, `auth.py`, `library.py`, `memory.py`, `channels.py` |
| `api/auth/` | Auth middleware: proxy secret, rate limits, NextAuth header extraction |
| `api/channels/` | Channel integration: `schemas.py`, `repository.py`, `provider.py` (Telegram), `responder.py` (SSE → channel), `router.py` (link tokens, accounts) |

## Agent runtime

| Path | Role |
| --- | --- |
| `agent/runtime/orchestrator.py` | Main single-agent ReAct loop, per-turn state, compaction, attachments, skill activation |
| `agent/runtime/planner.py` | Planner loop, `plan_create` / spawn / wait sequencing, planner-only prompt/tool handling |
| `agent/runtime/sub_agent_manager.py` | Worker lifecycle, shared prompt/tool bundle, dependency handling, handoff support, aggregate metrics |
| `agent/runtime/task_runner.py` | Task-agent execution loop and metrics capture for spawned workers |
| `agent/runtime/skill_selector.py` | Skill routing: explicit selection, attachment-aware hints, model pick, keyword fallback |
| `agent/runtime/system_prompt_sections.py` | Memory-aware prompt assembly and skill catalog injection |
| `agent/runtime/skill_setup.py` / `skill_install.py` / `skill_dependencies.py` | Mid-turn skill activation, dependency install, tool allowlists, sandbox-template setup |
| `agent/context/compaction.py` | Token-aware context compaction, CJK-aware estimation, fallbacks |
| `agent/context/profiles.py` | Runtime-specific compaction policy resolution (`web`, `channel`, `planner`, `task_agent`) |
| `agent/runtime/observer.py` | Compatibility shim re-exporting `agent.context` compaction APIs |

## Agent systems

| Path | Role |
| --- | --- |
| `agent/tools/` | Tool abstractions, immutable registry, local tools, sandbox tools, planner meta-tools |
| `agent/tools/executor.py` | Tool routing, lazy sandbox session creation, per-turn allowlists, artifact capture |
| `agent/sandbox/` | Sandbox providers and session abstractions; current builder wiring selects `boxlite` or `e2b` |
| `agent/skills/` | `SKILL.md` parsing, discovery, registry, install flows, and bundled skills |
| `agent/memory/` | Persistent memory, verified facts, heuristic extraction, pre-compaction fact flush |
| `agent/mcp/` | MCP config, repository/client layers, SSE bridge, and runtime models |
| `agent/state/` | SQLAlchemy async persistence, Pydantic schemas |

## Evaluations

| Path | Role |
| --- | --- |
| `evals/` | YAML cases, `llm_judge.py`, `grader.py` — see [Agent evals](agent-evals.md) |

## Dependency rule

`agent/` is the reusable harness core. It must not import `api` or `config`:
the app depends on the core, never the reverse. `tests/test_core_boundary.py`
enforces this in a clean subprocess (no `.env`, no credentials) and also runs
one full turn with a scripted LLM client, checking forbidden modules after the
turn to catch lazy runtime imports.

- **Events:** `agent.events` owns `EventEmitter`, `EventType`, `AgentEvent`
  and the `ResponseCoordinator` protocol. `api.events` re-exports them.
- **Settings:** core code calls `agent.config.get_settings()`. With no host
  it returns `HarnessSettings` defaults. The app installs its env-driven
  `Settings` with `config.settings.install_harness_settings()` (called by
  `api.main`, `evals`, and `tests/conftest.py`). When the core reads a new
  required setting, add it to `HarnessSettings` with the same default as
  `config/settings.py`. AST tests cover literal settings reads regardless of
  quotes or line breaks; optional fields absent from the dataclass need an
  explicit fallback exception. Dynamic `COMPACT_*` reads are enumerated and
  resolved compaction defaults are compared against app defaults for all four
  runtimes. Settings aliases must retain the `settings` / `*_settings` naming
  convention, or extend the scanner with regression coverage.
- **Shared types:** `agent.attachments` and `agent.mcp.state`. `api.models`
  re-exports them.

## Related

- [Architecture overview](architecture-overview.md)
- [Chat data flow](data-flow-chat.md)
- [Environment](environment.md)
