"""The event system is owned by the core; the app re-exports it."""

from __future__ import annotations

import asyncio

import agent.events
import api.events
from agent.events import AgentEvent, EventEmitter, EventType


def test_api_events_reexports_the_core_objects() -> None:
    assert api.events.EventEmitter is agent.events.EventEmitter
    assert api.events.EventType is agent.events.EventType
    assert api.events.AgentEvent is agent.events.AgentEvent
    assert api.events.SubscriberCallback is agent.events.SubscriberCallback
    assert api.events.ResponseCoordinator is agent.events.ResponseCoordinator


class _InMemoryCoordinator:
    """A non-database coordinator, as a library host would supply."""

    def __init__(self) -> None:
        self.prompts: list[dict[str, object]] = []
        self.resolved: list[str] = []
        self._future: asyncio.Future[str] | None = None

    async def register_prompt(self, **kwargs: object) -> None:
        self.prompts.append(kwargs)

    def register_local_waiter(
        self, *, conversation_id: str, request_id: str
    ) -> asyncio.Future[str]:
        self._future = asyncio.get_running_loop().create_future()
        return self._future

    def resolve_local(
        self, *, conversation_id: str, request_id: str, response: str
    ) -> None:
        self.resolved.append(response)
        if self._future is not None and not self._future.done():
            self._future.set_result(response)

    async def wait_for_response(
        self,
        *,
        conversation_id: str,
        request_id: str,
        future: asyncio.Future[str],
        timeout: float,
    ) -> str:
        return await asyncio.wait_for(future, timeout)


async def test_ask_user_round_trips_through_any_response_coordinator() -> None:
    coordinator = _InMemoryCoordinator()
    emitter = EventEmitter(conversation_id="c1", response_coordinator=coordinator)

    async def answer(event: AgentEvent) -> None:
        if event.type == EventType.ASK_USER:
            event.data["response_callback"]("blue")

    emitter.subscribe(answer)

    result = await emitter.emit_and_wait(
        EventType.ASK_USER, {"question": "Favourite colour?"}, timeout=1.0
    )

    assert result == "blue"
    assert coordinator.prompts[0]["question"] == "Favourite colour?"
    assert coordinator.resolved == ["blue"]
