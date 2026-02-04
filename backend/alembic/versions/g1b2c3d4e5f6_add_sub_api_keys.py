"""Add sub API keys table.

Revision ID: g1b2c3d4e5f6
Revises: f2c7b9d0a4e1
Create Date: 2026-02-04 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "g1b2c3d4e5f6"
down_revision = "f2c7b9d0a4e1"
branch_labels = None
depends_on = None


def _has_table(inspector, table: str) -> bool:
    return inspector.has_table(table)


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if _has_table(inspector, "sub_api_keys"):
        return
    op.create_table(
        "sub_api_keys",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("parent_api_key_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("name", sa.String(), nullable=False),
        sa.Column("key_hash", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("now()"), nullable=False),
        sa.Column("revoked", sa.Boolean(), server_default=sa.text("false"), nullable=False),
        sa.Column("can_read", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("can_write", sa.Boolean(), server_default=sa.text("true"), nullable=False),
        sa.Column("daily_limit", sa.Integer(), nullable=True),
        sa.Column("monthly_limit", sa.Integer(), nullable=True),
    )
    op.create_index("ix_sub_api_keys_parent", "sub_api_keys", ["parent_api_key_id"])
    op.create_index("ix_sub_api_keys_user", "sub_api_keys", ["user_id"])
    op.create_index("ix_sub_api_keys_key_hash", "sub_api_keys", ["key_hash"])


def downgrade() -> None:
    op.drop_index("ix_sub_api_keys_key_hash", table_name="sub_api_keys")
    op.drop_index("ix_sub_api_keys_user", table_name="sub_api_keys")
    op.drop_index("ix_sub_api_keys_parent", table_name="sub_api_keys")
    op.drop_table("sub_api_keys")
