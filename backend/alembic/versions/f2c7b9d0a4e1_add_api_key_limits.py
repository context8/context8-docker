"""Add daily/monthly limits to api_keys.

Revision ID: f2c7b9d0a4e1
Revises: 2f7d9c6a1b4e
Create Date: 2026-02-04 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "f2c7b9d0a4e1"
down_revision = "2f7d9c6a1b4e"
branch_labels = None
depends_on = None


def _has_column(inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not inspector.has_table("api_keys"):
        return
    if not _has_column(inspector, "api_keys", "daily_limit"):
        op.add_column("api_keys", sa.Column("daily_limit", sa.Integer(), nullable=True))
    if not _has_column(inspector, "api_keys", "monthly_limit"):
        op.add_column("api_keys", sa.Column("monthly_limit", sa.Integer(), nullable=True))


def downgrade() -> None:
    op.drop_column("api_keys", "monthly_limit")
    op.drop_column("api_keys", "daily_limit")
