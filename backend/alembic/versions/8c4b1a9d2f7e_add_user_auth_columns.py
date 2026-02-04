"""Add username/password columns to users.

Revision ID: 8c4b1a9d2f7e
Revises: e4a1c9b7d901
Create Date: 2026-01-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "8c4b1a9d2f7e"
down_revision: Union[str, Sequence[str], None] = "e4a1c9b7d901"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(inspector, table: str) -> bool:
    return table in inspector.get_table_names()


def _has_column(inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_table(inspector, "users"):
        return

    if not _has_column(inspector, "users", "id"):
        return

    for col in inspector.get_columns("users"):
        if col["name"] == "id" and not isinstance(col["type"], postgresql.UUID):
            op.execute("ALTER TABLE users ALTER COLUMN id TYPE uuid USING id::uuid")
            break

    if not _has_column(inspector, "users", "username"):
        op.add_column("users", sa.Column("username", sa.String(), nullable=True))
        op.execute("UPDATE users SET username = email WHERE username IS NULL OR username = ''")
        op.alter_column("users", "username", nullable=False)

    if not _has_column(inspector, "users", "password"):
        op.add_column(
            "users",
            sa.Column("password", sa.String(), nullable=False, server_default=sa.text("''")),
        )
        op.execute("UPDATE users SET password = '' WHERE password IS NULL")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if _has_table(inspector, "users"):
        for col in inspector.get_columns("users"):
            if col["name"] == "id" and isinstance(col["type"], postgresql.UUID):
                op.execute("ALTER TABLE users ALTER COLUMN id TYPE varchar USING id::text")
                break
        if _has_column(inspector, "users", "password"):
            op.drop_column("users", "password")
        if _has_column(inspector, "users", "username"):
            op.drop_column("users", "username")
