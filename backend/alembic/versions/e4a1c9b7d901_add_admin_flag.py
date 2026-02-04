"""Add is_admin flag to users.

Revision ID: e4a1c9b7d901
Revises: f7b2a1c9d2e5
Create Date: 2026-01-26 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "e4a1c9b7d901"
down_revision = "f7b2a1c9d2e5"
branch_labels = None
depends_on = None


def _has_column(inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not _has_column(inspector, "users", "is_admin"):
        op.add_column(
            "users",
            sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )


def downgrade() -> None:
    op.drop_column("users", "is_admin")
