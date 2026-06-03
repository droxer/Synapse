"""Add Discord channel bot configs.

Revision ID: 028
Revises: 027
Create Date: 2026-06-03
"""

from alembic import op
import sqlalchemy as sa

revision = "028"
down_revision = "027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "discord_bot_configs",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("bot_token", sa.Text(), nullable=False),
        sa.Column("bot_username", sa.String(length=200), nullable=False),
        sa.Column("bot_user_id", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("bot_user_id", name="uq_discord_bot_configs_bot_user"),
        sa.UniqueConstraint("user_id", name="uq_discord_bot_configs_user"),
    )
    op.create_index(
        "ix_discord_bot_configs_user_id", "discord_bot_configs", ["user_id"]
    )

    op.add_column(
        "channel_accounts",
        sa.Column("discord_bot_config_id", sa.Uuid(), nullable=True),
    )
    op.add_column(
        "channel_sessions",
        sa.Column("discord_bot_config_id", sa.Uuid(), nullable=True),
    )
    op.create_foreign_key(
        "fk_channel_accounts_discord_bot_config_id",
        "channel_accounts",
        "discord_bot_configs",
        ["discord_bot_config_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_channel_accounts_discord_bot_config_id",
        "channel_accounts",
        ["discord_bot_config_id"],
    )
    op.create_foreign_key(
        "fk_channel_sessions_discord_bot_config_id",
        "channel_sessions",
        "discord_bot_configs",
        ["discord_bot_config_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_channel_sessions_discord_bot_config",
        "channel_sessions",
        ["discord_bot_config_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_channel_sessions_discord_bot_config", table_name="channel_sessions"
    )
    op.drop_constraint(
        "fk_channel_sessions_discord_bot_config_id",
        "channel_sessions",
        type_="foreignkey",
    )
    op.drop_index(
        "ix_channel_accounts_discord_bot_config_id", table_name="channel_accounts"
    )
    op.drop_constraint(
        "fk_channel_accounts_discord_bot_config_id",
        "channel_accounts",
        type_="foreignkey",
    )
    op.drop_column("channel_sessions", "discord_bot_config_id")
    op.drop_column("channel_accounts", "discord_bot_config_id")
    op.drop_index("ix_discord_bot_configs_user_id", table_name="discord_bot_configs")
    op.drop_table("discord_bot_configs")
