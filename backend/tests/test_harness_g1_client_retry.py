"""LLM client retry policy: single retry layer, no duplicate streamed text."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

import anthropic
import httpx
import pytest

from agent.llm import client as client_module
from agent.llm.client import AnthropicClient

_REQUEST = httpx.Request("POST", "https://api.anthropic.test/v1/messages")


@pytest.fixture(autouse=True)
def _client_settings(monkeypatch) -> None:
    monkeypatch.setattr(
        "agent.llm.client.get_settings",
        lambda: SimpleNamespace(AGENT_DEBUG_LOGGING=False),
    )


def _status_error(status: int, headers: dict[str, str] | None = None) -> Exception:
    response = httpx.Response(status, request=_REQUEST, headers=headers or {})
    return anthropic.APIStatusError(
        f"Error code: {status}", response=response, body=None
    )


def _rate_limit(headers: dict[str, str] | None = None) -> Exception:
    response = httpx.Response(429, request=_REQUEST, headers=headers or {})
    return anthropic.RateLimitError("rate limited", response=response, body=None)


def _final_message(text: str = "ok") -> SimpleNamespace:
    return SimpleNamespace(
        content=[SimpleNamespace(type="text", text=text)],
        stop_reason="end_turn",
        usage=SimpleNamespace(input_tokens=1, output_tokens=1),
    )


@pytest.fixture
def sleeps(monkeypatch) -> list[float]:
    recorded: list[float] = []

    async def _fake_sleep(seconds: float) -> None:
        recorded.append(seconds)

    monkeypatch.setattr(client_module, "_backoff_sleep", _fake_sleep)
    return recorded


def _client(messages_api: Any) -> AnthropicClient:
    client = AnthropicClient.__new__(AnthropicClient)
    client._default_model = "m"
    client._default_max_tokens = 1024
    client._client = SimpleNamespace(messages=messages_api)
    return client


class _CreateAPI:
    def __init__(self, *outcomes: Any) -> None:
        self._outcomes = list(outcomes)
        self.calls = 0

    async def create(self, **kwargs: Any) -> Any:
        self.calls += 1
        outcome = self._outcomes.pop(0)
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


class _Stream:
    def __init__(self, events: list[Any], fail_after: Exception | None) -> None:
        self._events = list(events)
        self._fail_after = fail_after

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._events:
            return self._events.pop(0)
        if self._fail_after is not None:
            raise self._fail_after
        raise StopAsyncIteration

    async def get_final_message(self):
        return _final_message("hello")


class _StreamCtx:
    def __init__(self, stream: _Stream) -> None:
        self._stream = stream

    async def __aenter__(self):
        return self._stream

    async def __aexit__(self, *exc) -> bool:
        return False


class _StreamAPI:
    def __init__(self, *streams: _Stream) -> None:
        self._streams = list(streams)
        self.calls = 0

    def stream(self, **kwargs: Any) -> _StreamCtx:
        self.calls += 1
        return _StreamCtx(self._streams.pop(0))


def test_sdk_client_built_without_internal_retries(monkeypatch) -> None:
    captured: dict[str, Any] = {}

    class _FakeAsyncAnthropic:
        def __init__(self, **kwargs: Any) -> None:
            captured.update(kwargs)

    monkeypatch.setattr(anthropic, "AsyncAnthropic", _FakeAsyncAnthropic)

    AnthropicClient(api_key="k")

    assert captured.get("max_retries") == 0


async def test_stream_does_not_retry_after_text_was_emitted(sleeps) -> None:
    api = _StreamAPI(
        _Stream(
            [SimpleNamespace(type="text", text="partial ")],
            fail_after=anthropic.APIConnectionError(request=_REQUEST),
        ),
        _Stream([SimpleNamespace(type="text", text="hello")], fail_after=None),
    )
    deltas: list[str] = []

    async def on_delta(d: str) -> None:
        deltas.append(d)

    with pytest.raises(anthropic.APIConnectionError):
        await _client(api).create_message_stream(
            system="s",
            messages=[{"role": "user", "content": "hi"}],
            on_text_delta=on_delta,
        )

    assert api.calls == 1
    assert deltas == ["partial "]


async def test_stream_retries_when_nothing_was_emitted(sleeps) -> None:
    api = _StreamAPI(
        _Stream([], fail_after=anthropic.APIConnectionError(request=_REQUEST)),
        _Stream([SimpleNamespace(type="text", text="hello")], fail_after=None),
    )
    deltas: list[str] = []

    async def on_delta(d: str) -> None:
        deltas.append(d)

    response = await _client(api).create_message_stream(
        system="s",
        messages=[{"role": "user", "content": "hi"}],
        on_text_delta=on_delta,
    )

    assert response.text == "hello"
    assert api.calls == 2
    assert deltas == ["hello"]
    assert len(sleeps) == 1


@pytest.mark.parametrize("status", [400, 401, 403, 404, 422])
async def test_non_retryable_status_is_not_retried(sleeps, status: int) -> None:
    api = _CreateAPI(_status_error(status), _final_message())

    with pytest.raises(anthropic.APIStatusError):
        await _client(api).create_message(
            system="s", messages=[{"role": "user", "content": "hi"}]
        )

    assert api.calls == 1
    assert sleeps == []


@pytest.mark.parametrize("status", [500, 503, 529])
async def test_server_errors_are_retried(sleeps, status: int) -> None:
    api = _CreateAPI(_status_error(status), _final_message())

    response = await _client(api).create_message(
        system="s", messages=[{"role": "user", "content": "hi"}]
    )

    assert response.text == "ok"
    assert api.calls == 2


async def test_retry_after_header_is_honored(sleeps) -> None:
    api = _CreateAPI(_rate_limit({"retry-after": "7"}), _final_message())

    await _client(api).create_message(
        system="s", messages=[{"role": "user", "content": "hi"}]
    )

    assert sleeps == [7.0]


async def test_backoff_has_jitter_and_is_bounded(sleeps) -> None:
    api = _CreateAPI(
        anthropic.APIConnectionError(request=_REQUEST),
        anthropic.APIConnectionError(request=_REQUEST),
        _final_message(),
    )

    await _client(api).create_message(
        system="s", messages=[{"role": "user", "content": "hi"}]
    )

    assert len(sleeps) == 2
    assert 0 < sleeps[0] <= 1.0
    assert 0 < sleeps[1] <= 2.0
    # jittered values are (practically) never exact powers of two
    assert sleeps != [1.0, 2.0]
