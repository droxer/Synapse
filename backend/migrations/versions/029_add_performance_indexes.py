"""Add backend performance indexes.

Revision ID: 029
Revises: 028
Create Date: 2026-06-24
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "029"
down_revision = "028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    op.create_index(
        "ix_conversations_user_created",
        "conversations",
        ["user_id", "created_at"],
    )
    op.create_index("ix_conversations_created", "conversations", ["created_at"])
    op.create_index("ix_conversations_updated", "conversations", ["updated_at"])
    op.create_index(
        "ix_artifacts_conversation_created",
        "artifacts",
        ["conversation_id", "created_at"],
    )

    if dialect == "postgresql":
        op.execute(sa.text("CREATE EXTENSION IF NOT EXISTS pg_trgm"))
        op.execute(
            sa.text(
                """
                CREATE INDEX ix_memory_facts_key_trgm
                ON memory_facts
                USING gin (lower(key) gin_trgm_ops)
                WHERE status = 'active'
                """
            )
        )
        op.execute(
            sa.text(
                """
                CREATE INDEX ix_memory_facts_value_trgm
                ON memory_facts
                USING gin (lower(value) gin_trgm_ops)
                WHERE status = 'active'
                """
            )
        )


def downgrade() -> None:
    bind = op.get_bind()
    dialect = bind.dialect.name

    if dialect == "postgresql":
        op.drop_index("ix_memory_facts_value_trgm", table_name="memory_facts")
        op.drop_index("ix_memory_facts_key_trgm", table_name="memory_facts")

    op.drop_index("ix_artifacts_conversation_created", table_name="artifacts")
    op.drop_index("ix_conversations_updated", table_name="conversations")
    op.drop_index("ix_conversations_created", table_name="conversations")
    op.drop_index("ix_conversations_user_created", table_name="conversations")
