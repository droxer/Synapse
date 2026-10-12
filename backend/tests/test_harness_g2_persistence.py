"""Regression tests for atomic, idempotent message persistence (group 2)."""

from __future__ import annotations

import uuid
from types import SimpleNamespace
from typing import Any

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from agent.state.models import Base, EventModel, MessageModel
from agent.state.repository import ConversationRepository
from api.db_subscriber import create_db_subscriber
from api.events import AgentEvent, EventType


@pytest.fixture
async def session_factory():
    engine = create_async_engine("sqlite+aiosqlite:///:memory:")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    await engine.dispose()


class _FlakyEventRepo(ConversationRepository):
    """Fails the first ``save_event`` call with a transient DB error."""

    def __init__(self, failures: int = 1) -> None:
        self._failures = failures

    async def save_event(self, *args: Any, **kwargs: Any) -> None:
        if self._failures > 0:
            self._failures -= 1
            raise OperationalError("insert", {}, Exception("connection reset"))
        await super().save_event(*args, **kwargs)


async def _count(factory, model) -> int:
    async with factory() as s:
        return int((await s.execute(select(func.count()).select_from(model))).scalar())


@pytest.fixture(autouse=True)
def _fast_retries(monkeypatch) -> None:
    monkeypatch.setattr("api.db_subscriber._BASE_DELAY", 0.0)


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("event_type", "data"),
    [
        (EventType.TURN_START, {"message": "hello"}),
        (EventType.TURN_COMPLETE, {"result": "done"}),
        (EventType.USER_RESPONSE, {"response": "yes"}),
    ],
)
async def test_retry_after_event_failure_does_not_duplicate_message(
    session_factory, event_type: EventType, data: dict[str, Any]
) -> None:
    repo = _FlakyEventRepo()
    async with session_factory() as s:
        convo = await repo.create_conversation(s, title="t")

    subscriber = create_db_subscriber(convo.id, repo, session_factory)
    await subscriber(AgentEvent(type=event_type, data=data))

    assert await _count(session_factory, MessageModel) == 1
    assert await _count(session_factory, EventModel) == 1


@pytest.mark.asyncio
async def test_retried_turn_start_records_event_without_duplicate_user_row(
    session_factory,
) -> None:
    repo = ConversationRepository()
    async with session_factory() as s:
        convo = await repo.create_conversation(s, title="t")

    subscriber = create_db_subscriber(convo.id, repo, session_factory)
    await subscriber(AgentEvent(type=EventType.TURN_START, data={"message": "hi"}))
    await subscriber(
        AgentEvent(type=EventType.TURN_START, data={"message": "hi", "retry": True})
    )

    assert await _count(session_factory, MessageModel) == 1
    assert await _count(session_factory, EventModel) == 2


@pytest.mark.asyncio
async def test_save_message_with_same_id_is_idempotent(session_factory) -> None:
    repo = ConversationRepository()
    message_id = uuid.uuid4()
    async with session_factory() as s:
        convo = await repo.create_conversation(s, title="t")
        first = await repo.save_message(
            s, convo.id, role="user", content={"text": "a"}, message_id=message_id
        )
        second = await repo.save_message(
            s, convo.id, role="user", content={"text": "a"}, message_id=message_id
        )
    assert first.id == second.id == message_id
    assert await _count(session_factory, MessageModel) == 1


@pytest.mark.asyncio
async def test_save_message_without_commit_rolls_back_with_session(
    session_factory,
) -> None:
    repo = ConversationRepository()
    async with session_factory() as s:
        convo = await repo.create_conversation(s, title="t")
    async with session_factory() as s:
        await repo.save_message(
            s, convo.id, role="user", content={"text": "a"}, commit=False
        )
        await s.rollback()
    assert await _count(session_factory, MessageModel) == 0


@pytest.mark.asyncio
async def test_context_summary_merge_is_atomic_with_event(
    session_factory, monkeypatch
) -> None:
    monkeypatch.setattr("api.db_subscriber.get_settings", lambda: SimpleNamespace())
    repo = _FlakyEventRepo()
    async with session_factory() as s:
        convo = await repo.create_conversation(s, title="t")

    subscriber = create_db_subscriber(convo.id, repo, session_factory)
    await subscriber(
        AgentEvent(
            type=EventType.CONTEXT_COMPACTED,
            data={
                "summary_text": "## Previous work\n- x",
                "summary_scope": "conversation",
            },
        )
    )

    async with session_factory() as s:
        record = await repo.get_conversation(s, convo.id)
    assert record is not None
    assert record.context_summary == "## Previous work\n- x"
