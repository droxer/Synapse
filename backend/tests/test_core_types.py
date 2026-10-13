"""Types shared by the core and the HTTP layer are owned by the core."""

from __future__ import annotations

import api.models
from agent.attachments import (
    VISION_MIME_TYPES,
    FileAttachment,
    serialize_attachment_metadata,
)
from agent.mcp.state import MCPState


def test_api_models_reexports_the_core_types() -> None:
    assert api.models.VISION_MIME_TYPES is VISION_MIME_TYPES
    assert api.models.FileAttachment is FileAttachment
    assert api.models.serialize_attachment_metadata is serialize_attachment_metadata
    assert api.models.MCPState is MCPState


def test_attachment_metadata_keeps_its_wire_shape() -> None:
    attachment = FileAttachment(
        filename="chart.png", content_type="image/png", data=b"x", size=1
    )

    assert serialize_attachment_metadata((attachment,)) == [
        {"name": "chart.png", "size": 1, "type": "image/png"}
    ]


def test_mcp_state_shows_users_global_and_their_own_servers() -> None:
    global_cfg, mine, theirs = object(), object(), object()
    state = MCPState(
        configs={"search": global_cfg, "u1:notes": mine, "u2:notes": theirs}
    )

    assert state.configs_for_user("u1") == {"search": global_cfg, "u1:notes": mine}
    assert state.configs_for_user(None) == {"search": global_cfg}
    assert MCPState.user_key("u1", "notes") == "u1:notes"
