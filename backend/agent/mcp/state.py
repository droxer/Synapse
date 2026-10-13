"""MCP lifecycle state shared by the MCP tools and their host."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any

from agent.mcp.client import MCPClient
from agent.mcp.config import MCPServerConfig
from agent.tools.registry import ToolRegistry


@dataclass
class MCPState:
    """Container for MCP lifecycle state, stored on app.state.

    Keys in ``clients`` and ``configs`` are namespaced:
    - Global (env-var) servers: key = server name
    - Per-user servers: key = ``{user_id}:{server_name}``
    """

    registry: ToolRegistry | None = None
    clients: dict[str, MCPClient] = field(default_factory=dict)
    configs: dict[str, MCPServerConfig] = field(default_factory=dict)
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)

    @staticmethod
    def user_key(user_id: Any, name: str) -> str:
        """Build a namespaced key for a per-user MCP server."""
        return f"{user_id}:{name}"

    def configs_for_user(self, user_id: Any | None) -> dict[str, MCPServerConfig]:
        """Return configs visible to a user (global + user-owned)."""
        if user_id is None:
            return {key: cfg for key, cfg in self.configs.items() if ":" not in key}

        prefix = f"{user_id}:"
        result: dict[str, MCPServerConfig] = {}
        for key, cfg in self.configs.items():
            if ":" not in key:
                # Global server (from env var)
                result[key] = cfg
            elif key.startswith(prefix):
                result[key] = cfg
        return result
