# SSE subscription regression evidence

User journeys derived from the two review findings: simultaneous clients receive
live events independently; reconnecting during a queue write does not let an old
reader steal the new client’s event.

- RED: `python -m pytest backend/tests/test_sse_stream.py -q` ran the two new
  regressions against the previous implementation: 2 failed, 2 passed.
- GREEN: one conversation broadcaster now feeds bounded queues for each client.
  The last disconnect cancels the broadcaster and restores unread events before
  the offline backlog. Callback request IDs are generated once before fan-out.
- A cleanup regression failed before adding the terminal notification; cleanup
  now ends connected streams and the broadcaster.
- Validation: `python -m pytest backend/tests/test_sse_stream.py
  backend/tests/test_events.py backend/tests/test_conversations.py
  backend/tests/test_channels.py backend/tests/test_v1_public_api.py
  backend/tests/test_conversation_hooks.py --cov=api.sse
  --cov-report=term-missing -q`: 162 passed, SSE module coverage 93%.
- Ruff checks passed for the changed Python files.

Tests also cover idle keepalive, cancellation after fan-out, disconnecting one
of two clients, unread-event ordering on reconnect, slow-client backpressure,
and delivering conversation end to all clients, including a full structural
queue. No browser E2E was run; these
changes affect backend subscription ownership, not the frontend protocol.
