"""Shared models, protocols, and constants for the API layer."""

from __future__ import annotations

import asyncio
import time as _time
from typing import Any, Protocol

from pydantic import AliasChoices, BaseModel, Field, field_validator

from agent.mcp.config import MCP_RESERVED_HTTP_HEADERS
from agent.tools.executor import ToolExecutor
from api.events import AgentEvent, EventEmitter
from agent.attachments import VISION_MIME_TYPES as VISION_MIME_TYPES
from agent.attachments import FileAttachment as FileAttachment
from agent.attachments import (
    serialize_attachment_metadata as serialize_attachment_metadata,
)
from agent.mcp.state import MCPState as MCPState

# UUID pattern for path parameter validation
_UUID_PATTERN = r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$"

# Max event queue size for backpressure
_EVENT_QUEUE_MAXSIZE = 5000

# Stale conversation TTL in seconds (1 hour)
_CONVERSATION_TTL_SECONDS = 3600

# Default port for sandbox preview proxy
_DEFAULT_PREVIEW_PORT = 8080

# File upload constraints
MAX_FILE_SIZE_MB = 25
MAX_FILES_PER_MESSAGE = 10


class Runnable(Protocol):
    """Protocol for orchestrators that can run a turn."""

    async def run(
        self,
        user_message: str,
        attachments: tuple[FileAttachment, ...] = (),
        selected_skills: tuple[str, ...] = (),
        runtime_prompt_sections: tuple[str, ...] = (),
        turn_metadata: dict[str, Any] | None = None,
    ) -> str: ...


class Cancellable(Protocol):
    """Protocol for orchestrators that support cancellation and retry."""

    def cancel(self) -> None: ...

    def reset_cancel(self) -> None: ...

    def get_last_user_message(self) -> str | None: ...

    def rollback_to_before_last_user_message(self) -> None: ...


class ConversationEntry:
    """Container for a conversation's resources. Lives across multiple turns."""

    __slots__ = (
        "emitter",
        "event_queue",
        "pending_callbacks",
        "subscriber",
        "orchestrator",
        "executor",
        "turn_task",
        "created_at",
        "last_attachments",
        "last_selected_skills",
        "idempotency_cache",
        "idempotency_tasks",
        "background_tasks",
        "orchestrator_mode",
        "lock",
        "stream_queues",
        "stream_task",
    )

    def __init__(
        self,
        emitter: EventEmitter,
        event_queue: asyncio.Queue[AgentEvent | None],
        orchestrator: Runnable | None,
        executor: ToolExecutor | None,
        pending_callbacks: dict[str, Any],
        orchestrator_mode: str = "agent",
    ) -> None:
        self.emitter = emitter
        self.event_queue = event_queue
        self.orchestrator = orchestrator
        self.executor = executor
        self.pending_callbacks = pending_callbacks
        self.subscriber: Any = None
        self.turn_task: asyncio.Task[str] | None = None
        self.created_at: float = _time.monotonic()
        self.last_attachments: tuple[FileAttachment, ...] = ()
        self.last_selected_skills: tuple[str, ...] = ()
        self.idempotency_cache: dict[str, str] = {}
        self.idempotency_tasks: dict[str, asyncio.Task[str]] = {}
        self.background_tasks: set[asyncio.Task[None]] = set()
        self.orchestrator_mode = orchestrator_mode
        self.lock = asyncio.Lock()
        # One queue per connected SSE client, fed by a single conversation reader.
        self.stream_queues: set[asyncio.Queue[AgentEvent | None]] = set()
        self.stream_task: asyncio.Task[None] | None = None


class MessageRequest(BaseModel):
    """Request body for creating a conversation or sending a message."""

    message: str = Field(max_length=100_000)
    skills: list[str] = Field(default_factory=list)
    use_planner: bool | None = Field(
        default=None,
        description="When True, force planner orchestration for this turn. When False, force single-agent orchestration.",
    )
    idempotency_key: str | None = Field(
        default=None,
        max_length=128,
        description="Optional key; duplicate requests with the same key return the cached result.",
    )

    @field_validator("message")
    @classmethod
    def message_must_not_be_blank(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("message must not be empty")
        return v


class ConversationResponse(BaseModel):
    """Response body for conversation endpoints."""

    conversation_id: str


class ConversationSuggestion(BaseModel):
    """A suggested next prompt for the landing screen."""

    label: str = Field(max_length=80)
    prompt: str = Field(max_length=500)


class ConversationSuggestionsResponse(BaseModel):
    """Response body for generated conversation suggestions."""

    suggestions: list[ConversationSuggestion] = Field(
        default_factory=list, max_length=3
    )


class UserInputRequest(BaseModel):
    """Request body for POST /conversations/{id}/respond."""

    request_id: str
    response: str = Field(max_length=50000)


class MCPServerResponse(BaseModel):
    """Response model for a single MCP server."""

    name: str
    transport: str
    url: str = ""
    headers: dict[str, str] = Field(default_factory=dict)
    timeout: float = 30.0
    status: str  # "connected" | "disconnected"
    tool_count: int = 0
    enabled: bool = True
    editable: bool = True


class ConversationMetricsResponse(BaseModel):
    """Aggregated metrics for a single conversation."""

    conversation_id: str
    total_input_tokens: int
    total_output_tokens: int
    context_compaction_count: int
    tool_call_counts: dict[str, int] = Field(default_factory=dict)
    per_agent_metrics: dict[str, dict[str, Any]] = Field(default_factory=dict)
    sandbox_execution_time: float = 0.0


class MCPServerCreateRequest(BaseModel):
    """Request body for adding a new MCP server."""

    name: str = Field(max_length=100)
    transport: str = Field(validation_alias=AliasChoices("transport", "type"))
    url: str = ""
    headers: dict[str, str] = Field(default_factory=dict)
    timeout: float = 30.0

    @field_validator("transport")
    @classmethod
    def transport_must_be_valid(cls, v: str) -> str:
        if v not in ("sse", "streamablehttp"):
            raise ValueError("transport must be 'sse' or 'streamablehttp'")
        return v

    @field_validator("url")
    @classmethod
    def sse_requires_url(cls, v: str, info: Any) -> str:
        transport = info.data.get("transport", "")
        if transport in ("sse", "streamablehttp"):
            if not v.strip():
                raise ValueError(f"{transport} transport requires a non-empty url")
            if not v.startswith(("http://", "https://")):
                raise ValueError(f"{transport} url must start with http:// or https://")
        return v

    @field_validator("headers")
    @classmethod
    def headers_must_be_safe(cls, v: dict[str, str]) -> dict[str, str]:
        for name, value in v.items():
            if not name.strip():
                raise ValueError("MCP HTTP header names must not be empty")
            if "\n" in name or "\r" in name or "\n" in value or "\r" in value:
                raise ValueError("MCP HTTP headers must not contain newlines")
            if name.lower() in MCP_RESERVED_HTTP_HEADERS:
                raise ValueError(f"MCP HTTP header {name!r} is managed by Synapse")
        return v


class MCPServerUpdateRequest(MCPServerCreateRequest):
    """Request body for updating an existing MCP server."""
