from __future__ import annotations

from contextlib import asynccontextmanager
from unittest.mock import AsyncMock

import httpx
import pytest

from agent.tools.local import web_fetch
from agent.tools.local.web_fetch import WebFetch


class _MockAsyncClient:
    def __init__(self, responses: list[httpx.Response]) -> None:
        self._responses = responses
        self._calls = 0

    async def __aenter__(self) -> _MockAsyncClient:
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    @asynccontextmanager
    async def stream(self, method: str, url: str):
        if self._calls >= len(self._responses):
            raise AssertionError(f"Unexpected fetch for {url}")
        response = self._responses[self._calls]
        self._calls += 1
        yield response


@pytest.mark.asyncio
async def test_web_fetch_blocks_private_redirect_targets(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    start_url = "https://example.com/start"
    blocked_url = "http://169.254.169.254/latest/meta-data"

    redirect = httpx.Response(
        302,
        headers={"location": blocked_url},
        request=httpx.Request("GET", start_url),
    )

    monkeypatch.setattr(
        web_fetch.httpx,
        "AsyncClient",
        lambda **_: _MockAsyncClient([redirect]),
    )
    monkeypatch.setattr(
        web_fetch,
        "_validate_url",
        lambda candidate: "redirect blocked" if candidate == blocked_url else None,
    )

    tool = WebFetch()
    result = await tool.execute(url=start_url)

    assert not result.success
    assert result.error == "URL blocked: redirect blocked"


@pytest.mark.asyncio
async def test_web_fetch_returns_final_redirect_url_in_metadata(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    start_url = "https://example.com/start"
    redirected_url = "https://example.com/final"

    redirect = httpx.Response(
        302,
        headers={"location": redirected_url},
        request=httpx.Request("GET", start_url),
    )
    final = httpx.Response(
        200,
        text="<html><body>Hello</body></html>",
        request=httpx.Request("GET", redirected_url),
    )

    monkeypatch.setattr(
        web_fetch.httpx,
        "AsyncClient",
        lambda **_: _MockAsyncClient([redirect, final]),
    )
    monkeypatch.setattr(web_fetch, "_validate_url", lambda candidate: None)

    tool = WebFetch()
    result = await tool.execute(url=start_url)

    assert result.success
    assert result.metadata["url"] == redirected_url
    assert result.metadata["requested_url"] == start_url
    assert result.metadata["redirected"] is True


@pytest.mark.asyncio
async def test_socket_connect_uses_validated_numeric_ip(monkeypatch):
    def lookup(*args):
        return [(2, 1, 6, "", ("93.184.216.34", 443))]

    monkeypatch.setattr(web_fetch.socket, "getaddrinfo", lookup)
    connect = AsyncMock(return_value="connected")
    monkeypatch.setattr(web_fetch.AutoBackend, "connect_tcp", connect)
    result = await web_fetch.PublicNetworkBackend().connect_tcp("example.com", 443)
    assert result == "connected"
    connect.assert_awaited_once_with("93.184.216.34", 443)


@pytest.mark.asyncio
async def test_rebinding_private_ip_is_rejected_at_socket_boundary(monkeypatch):
    monkeypatch.setattr(
        web_fetch.socket,
        "getaddrinfo",
        lambda *args: [(2, 1, 6, "", ("127.0.0.1", 443))],
    )
    connect = AsyncMock()
    monkeypatch.setattr(web_fetch.AutoBackend, "connect_tcp", connect)
    with pytest.raises(ValueError, match="non-public"):
        await web_fetch.PublicNetworkBackend().connect_tcp("rebind.test", 443)
    connect.assert_not_awaited()


@pytest.mark.asyncio
async def test_fetch_bounds_response_size(monkeypatch):
    url = "https://example.com/large"
    response = httpx.Response(
        200,
        content=b"x" * (web_fetch._MAX_RESPONSE_BYTES + 1),
        request=httpx.Request("GET", url),
    )
    monkeypatch.setattr(
        web_fetch.httpx, "AsyncClient", lambda **kwargs: _MockAsyncClient([response])
    )
    monkeypatch.setattr(web_fetch, "_validate_url", lambda url: None)
    result = await WebFetch().execute(url=url)
    assert not result.success
    assert "size limit" in result.error


@pytest.mark.asyncio
async def test_fetch_decodes_compressed_response_once(monkeypatch):
    import gzip

    url = "https://example.com/gzip"
    response = httpx.Response(
        200,
        headers={"content-encoding": "gzip", "content-type": "text/plain"},
        content=gzip.compress(b"hello compressed world"),
        request=httpx.Request("GET", url),
    )
    monkeypatch.setattr(
        web_fetch.httpx, "AsyncClient", lambda **kwargs: _MockAsyncClient([response])
    )
    monkeypatch.setattr(web_fetch, "_validate_url", lambda url: None)
    result = await WebFetch().execute(url=url)
    assert result.success, result.error
    assert "hello compressed world" in result.output


@pytest.mark.asyncio
async def test_fetch_tolerates_null_max_length(monkeypatch):
    url = "https://example.com/plain"
    response = httpx.Response(
        200,
        headers={"content-type": "text/plain"},
        content=b"plain body",
        request=httpx.Request("GET", url),
    )
    monkeypatch.setattr(
        web_fetch.httpx, "AsyncClient", lambda **kwargs: _MockAsyncClient([response])
    )
    monkeypatch.setattr(web_fetch, "_validate_url", lambda url: None)
    result = await WebFetch().execute(url=url, max_length=None)
    assert result.success, result.error


@pytest.mark.asyncio
async def test_public_transport_routes_real_connections_through_validating_backend(
    monkeypatch,
):
    monkeypatch.setattr(
        web_fetch.socket,
        "getaddrinfo",
        lambda *args: [(2, 1, 6, "", ("127.0.0.1", 80))],
    )
    async with httpx.AsyncClient(transport=web_fetch._public_transport()) as client:
        with pytest.raises(ValueError, match="non-public"):
            await client.get("http://rebinding.example/")


def test_public_transport_fails_closed_when_httpcore_internals_drift(monkeypatch):
    class _DriftedPool:
        __slots__ = ("_renamed_backend",)

    monkeypatch.setattr(
        web_fetch.httpx.AsyncHTTPTransport,
        "__init__",
        lambda self, *args, **kwargs: setattr(self, "_pool", _DriftedPool()),
    )
    with pytest.raises(RuntimeError, match="network backend"):
        web_fetch._public_transport()


def test_public_transport_rejects_pool_without_backend_attribute(monkeypatch):
    class _DriftedPool:
        pass

    monkeypatch.setattr(
        web_fetch.httpx.AsyncHTTPTransport,
        "__init__",
        lambda self, *args, **kwargs: setattr(self, "_pool", _DriftedPool()),
    )
    with pytest.raises(RuntimeError, match="network backend"):
        web_fetch._public_transport()
