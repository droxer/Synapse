# Backend harness continuation evidence

This continues the backend harness review and fixes. The supplied handoff did
not include the original findings list. Scope was recovered from the task's
commits: `0b8c9c3` (agent loop), `7eb9117` (compaction, memory, persistence),
and `74d9c00` (conversation lifecycle), plus the inherited working tree.

## Guarantees and evidence

| User journey / guarantee | Regression target | Evidence |
| --- | --- | --- |
| Retrying a turn keeps one canonical user message while recording both starts | `test_harness_g2_persistence.py::test_retried_turn_start_records_event_without_duplicate_user_row` | RED: `assert 2 == 1` with the retry guard removed in memory; GREEN in the full run |
| Channel memory output does not describe saved facts as verified | `test_channels.py::TestChannelRouterMemoryCommands::test_memory_command_lists_saved_facts` | RED with the previous label restored in memory; GREEN in the full run |
| Conversation test repositories accept atomic message-write arguments | Three `save_message` doubles in `test_conversations.py` | GREEN in the full run |
| Agent and planner cache the complete stable prompt prefix and leave memory volatile | Two cache tests in `test_runtime_guardrails.py` | Initial tests failed because they expected the first block to be cached; corrected assertions check the last stable block and earlier blocks |
| Search settings tests are independent of ambient Tavily credentials | `test_search_provider.py` | Initial full run had two failures from ambient test credentials; explicit fixture inputs pass |
| Agent loop, compaction, memory and lifecycle regressions remain fixed | `tests/test_harness*` | `123 passed in 1.18s` |

The retry guard and channel label changes were already in the inherited working
tree. RED was reconstructed by loading the previous behavior into the module in
an isolated Python process, then invoking the named pytest test. No production
files were reverted. New checkpoint commits were not created during this
continuation; this report preserves the observed RED/GREEN evidence.

## Validation

Commands ran from `backend/`, using the existing environment's Python:

```bash
PYTHONPATH=. /Users/feihe/Workspace/Synapse/backend/.venv/bin/python -m pytest -q tests/test_harness*
PYTHONPATH=. /Users/feihe/Workspace/Synapse/backend/.venv/bin/python -m pytest -q --ignore=tests/test_cli.py --cov=agent --cov=api --cov-report=term:skip-covered
/Users/feihe/Workspace/Synapse/backend/.venv/bin/python -m ruff check .
/Users/feihe/Workspace/Synapse/backend/.venv/bin/python -m ruff format --check api/db_subscriber.py api/channels/router.py tests/test_channels.py tests/test_harness_g2_persistence.py tests/test_conversations.py tests/test_runtime_guardrails.py tests/test_search_provider.py
git diff --check
```

Results: **1,254 passed in 11.17s**, lint clean, seven edited Python files
formatted, and no whitespace errors.

Coverage across `agent` and `api` is **75%**. Core harness coverage includes
engine 92%, message repair 95%, LLM client 85%, compaction 88%, orchestrator
88%, conversation lifecycle 89%, and DB subscriber 80%. The overall 80%
target is not met; this continuation does not claim otherwise.

## Review follow-up (2026-10-13)

A review of the security and worker changes found the regressions below. Each
fix began with a test that failed against the reviewed code (RED), then passed
after the change (GREEN).

| Guarantee | Regression target | RED observed |
| --- | --- | --- |
| `web_fetch` decodes gzip/brotli bodies once | `test_web_fetch.py::test_fetch_decodes_compressed_response_once` | `DecodingError: incorrect header check` |
| Invalid `max_length` / `max_steps` fall back to defaults | `test_fetch_tolerates_null_max_length`, `test_browser_use.py::test_browser_agent_tolerates_invalid_max_steps` | `TypeError` |
| Worker waits and user prompts are not cut off by the 300s tool deadline | `test_harness_g3_security.py::test_worker_waits_and_user_prompts_are_exempt_from_tool_deadline` | `Tool deadline exceeded` |
| HTML artifacts may script only in an opaque origin; PDFs are unsandboxed so Chromium renders them | `test_artifacts_route.py` (two tests), `web/src/shared/components/FilePreview.test.tsx` (two tests) | Strict sandbox on every type; frontend iframe granted `allow-same-origin` |
| Passive remote artifacts redirect to storage (range requests, CDN bandwidth) | `test_remote_passive_artifacts_redirect_to_storage` | Proxied through the API |
| Browser agent failures are logged with their cause | `test_browser_agent_failure_is_logged_with_cause` | Error swallowed without a log |
| Boxlite commands without a timeout get the 300s tool ceiling, not 60s | `test_boxlite_provider.py::test_exec_deadline_defaults_to_tool_ceiling_and_is_capped` | Deadline `60` |
| E2B renewal never shortens a longer configured lifetime | `test_e2b_renewal_never_shortens_a_longer_configured_lifetime` | `set_timeout(360)` for a 3600s lifetime |
| A running worker's reservation and live usage count once | `test_harness_g4_workers.py::test_running_worker_reservation_is_not_double_counted_with_live_usage` | Reservation plus live usage summed |
| Socket-level SSRF validation is wired into real requests, and fetching refuses to run if httpcore internals drift | `test_public_transport_routes_real_connections_through_validating_backend`, two drift tests | Renamed backend attribute was silently accepted (fail-open) |

Validation, from `backend/` with Python 3.12 and proxy variables unset (an
ambient SOCKS proxy makes four network-mock tests require `socksio`):

```bash
.venv/bin/python -m pytest -q --ignore=tests/test_cli.py --cov=agent --cov=api
.venv/bin/ruff format --check <changed files>
.venv/bin/ruff check <changed files>   # compared against HEAD
git diff --check
```

Results: **1,299 passed**, all 31 changed Python files formatted, no new lint
findings compared with `HEAD`, and no whitespace errors. Coverage across `agent`
and `api` is **76%**, still below the 80% target. Frontend:
`npx jest src/shared/components` reported 59 passed; eslint and `tsc --noEmit`
were clean.

The remaining `BLE001` findings in changed files were already present at
`HEAD`. The one newly introduced boundary (artifact publication in
`ToolExecutor`) is intentionally broad and annotated. Remote artifact proxy
errors now catch only `httpx` errors. The PDF and HTML iframe behavior has
not been checked in a real browser.

## Known validation gaps

- Unfiltered pytest collection fails in `tests/test_cli.py` because it imports
  `cli.main`, but no `cli` package exists in this checkout. That unrelated test
  file was explicitly excluded from the broader run.
- A fresh `uv run pytest` selected Python 3.13, incompatible with the locked
  BoxLite wheel. Python 3.12 setup then failed on a blocked dependency download.
  Tests ran using the existing Python 3.13 environment, with installed packages
  and mocked provider boundaries; no live provider validation was performed.
- `python -m pip_audit --version` reports that `pip_audit` is unavailable in the
  existing environment. No dependency audit result is claimed, and no commit
  or push was performed.
