"""Compatibility facade for the retired cross-conversation E2B pool.

An arbitrary executed VM cannot be sanitised by deleting one directory.
Sessions are now fresh per executor and destroyed when their owner ends.
"""

from __future__ import annotations

from typing import Any


class SandboxPool:
    """Keep existing provider wiring while forbidding reuse of executed VMs."""

    def __init__(
        self, api_key: str, max_per_key: int = 3, max_idle_seconds: int = 600
    ) -> None:
        pass

    async def acquire(self, config: Any) -> None:
        return None

    async def release(self, session: Any) -> None:
        kill = getattr(session, "kill", None)
        if callable(kill):
            await kill()
        else:
            await session.close()

    async def drain(self) -> None:
        # No sessions are retained.
        pass
