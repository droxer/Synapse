from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock
import httpx

import pytest

from agent.state.repository import ConversationRepository
from api.routes.artifacts import list_conversation_artifacts, get_artifact
from agent.artifacts.storage import LocalStorageBackend


@pytest.mark.asyncio
async def test_list_conversation_artifacts_returns_persisted_artifacts(session) -> None:
    repo = ConversationRepository()
    convo = await repo.create_conversation(session, title="Artifact route test")
    artifact_id = "a" * 32
    await repo.save_artifact(
        session,
        artifact_id=artifact_id,
        conversation_id=convo.id,
        storage_key=f"{artifact_id}.docx",
        original_name="report.docx",
        content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size=15991,
        file_path="/workspace/report.docx",
    )

    payload = await list_conversation_artifacts(
        conversation_id=str(convo.id),
        session=session,
        state=SimpleNamespace(db_repo=repo),
        auth_user=None,
    )

    assert len(payload["artifacts"]) == 1
    assert payload["artifacts"][0]["id"] == artifact_id
    assert payload["artifacts"][0]["name"] == "report.docx"
    assert payload["artifacts"][0]["content_type"] == (
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
    assert payload["artifacts"][0]["file_path"] == "/workspace/report.docx"


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "mime,filename", [("text/html", "page.html"), ("image/svg+xml", "image.svg")]
)
async def test_inline_artifacts_have_opaque_sandbox_and_nosniff(
    session, tmp_path, mime, filename
):
    repo = ConversationRepository()
    convo = await repo.create_conversation(session, title="Untrusted artifact")
    storage = LocalStorageBackend(str(tmp_path))
    await storage.save(
        filename, b"<script>parent.document.body.remove()</script>", mime
    )
    await repo.save_artifact(
        session,
        artifact_id="b" * 32,
        conversation_id=convo.id,
        storage_key=filename,
        original_name=filename,
        content_type=mime,
        size=50,
    )
    response = await get_artifact(
        conversation_id=str(convo.id),
        artifact_id="b" * 32,
        inline=True,
        session=session,
        state=SimpleNamespace(db_repo=repo, storage_backend=storage),
        auth_user=None,
    )
    assert "sandbox" in response.headers["content-security-policy"]
    assert "allow-same-origin" not in response.headers["content-security-policy"]
    assert response.headers["x-content-type-options"] == "nosniff"


@pytest.mark.asyncio
async def test_remote_html_is_proxied_with_sandbox_headers(session, monkeypatch):
    repo = ConversationRepository()
    convo = await repo.create_conversation(session, title="Remote artifact")
    await repo.save_artifact(
        session,
        artifact_id="c" * 32,
        conversation_id=convo.id,
        storage_key="page.html",
        original_name="page.html",
        content_type="text/html",
        size=20,
    )
    storage = SimpleNamespace(
        get_url=AsyncMock(return_value="https://storage.test/page.html")
    )
    client_class = httpx.AsyncClient
    transport = httpx.MockTransport(
        lambda request: httpx.Response(200, content=b"<script>bad()</script>")
    )
    monkeypatch.setattr(
        "api.routes.artifacts.httpx.AsyncClient",
        lambda **kwargs: client_class(transport=transport, **kwargs),
    )
    response = await get_artifact(
        conversation_id=str(convo.id),
        artifact_id="c" * 32,
        inline=True,
        session=session,
        state=SimpleNamespace(db_repo=repo, storage_backend=storage),
        auth_user=None,
    )
    assert "sandbox" in response.headers["content-security-policy"]
    assert "location" not in response.headers
    assert (
        b"".join([chunk async for chunk in response.body_iterator])
        == b"<script>bad()</script>"
    )


@pytest.mark.asyncio
async def test_remote_storage_errors_are_reported_before_streaming(
    session, monkeypatch
):
    from fastapi import HTTPException

    repo = ConversationRepository()
    convo = await repo.create_conversation(session, title="Missing artifact")
    await repo.save_artifact(
        session,
        artifact_id="d" * 32,
        conversation_id=convo.id,
        storage_key="page.html",
        original_name="page.html",
        content_type="text/html",
        size=20,
    )
    storage = SimpleNamespace(
        get_url=AsyncMock(return_value="https://storage.test/page.html")
    )
    client_class = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(404))
    monkeypatch.setattr(
        "api.routes.artifacts.httpx.AsyncClient",
        lambda **kwargs: client_class(transport=transport, **kwargs),
    )
    with pytest.raises(HTTPException) as error:
        await get_artifact(
            conversation_id=str(convo.id),
            artifact_id="d" * 32,
            inline=True,
            session=session,
            state=SimpleNamespace(db_repo=repo, storage_backend=storage),
            auth_user=None,
        )
    assert error.value.status_code == 502


async def _serve_local(session, tmp_path, mime, filename, body=b"data"):
    repo = ConversationRepository()
    convo = await repo.create_conversation(session, title="Artifact headers")
    storage = LocalStorageBackend(str(tmp_path))
    await storage.save(filename, body, mime)
    await repo.save_artifact(
        session,
        artifact_id="e" * 32,
        conversation_id=convo.id,
        storage_key=filename,
        original_name=filename,
        content_type=mime,
        size=len(body),
    )
    return await get_artifact(
        conversation_id=str(convo.id),
        artifact_id="e" * 32,
        inline=True,
        session=session,
        state=SimpleNamespace(db_repo=repo, storage_backend=storage),
        auth_user=None,
    )


@pytest.mark.asyncio
async def test_html_artifacts_may_run_scripts_only_in_an_opaque_origin(
    session, tmp_path
):
    response = await _serve_local(
        session, tmp_path, "text/html; charset=utf-8", "chart.html"
    )
    policy = response.headers["content-security-policy"]
    assert "allow-scripts" in policy
    assert "allow-same-origin" not in policy


@pytest.mark.asyncio
async def test_pdf_artifacts_are_not_sandboxed_so_the_browser_viewer_renders(
    session, tmp_path
):
    response = await _serve_local(session, tmp_path, "application/pdf", "report.pdf")
    assert "content-security-policy" not in response.headers
    assert response.headers["x-content-type-options"] == "nosniff"


@pytest.mark.asyncio
async def test_remote_passive_artifacts_redirect_to_storage(session, monkeypatch):
    repo = ConversationRepository()
    convo = await repo.create_conversation(session, title="Remote video")
    await repo.save_artifact(
        session,
        artifact_id="f" * 32,
        conversation_id=convo.id,
        storage_key="clip.mp4",
        original_name="clip.mp4",
        content_type="video/mp4",
        size=20,
    )
    storage = SimpleNamespace(
        get_url=AsyncMock(return_value="https://storage.test/clip.mp4")
    )
    monkeypatch.setattr(
        "api.routes.artifacts.httpx.AsyncClient",
        lambda **kwargs: pytest.fail("passive artifacts must not be proxied"),
    )
    response = await get_artifact(
        conversation_id=str(convo.id),
        artifact_id="f" * 32,
        inline=True,
        session=session,
        state=SimpleNamespace(db_repo=repo, storage_backend=storage),
        auth_user=None,
    )
    assert response.status_code == 307
    assert response.headers["location"] == "https://storage.test/clip.mp4"
