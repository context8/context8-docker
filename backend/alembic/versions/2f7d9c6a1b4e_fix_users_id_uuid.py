"""Fix users.id to UUID type.

Revision ID: 2f7d9c6a1b4e
Revises: 8c4b1a9d2f7e
Create Date: 2026-01-27
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "2f7d9c6a1b4e"
down_revision: Union[str, Sequence[str], None] = "8c4b1a9d2f7e"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_table(inspector, table: str) -> bool:
    return table in inspector.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_table(inspector, "users"):
        return

    for col in inspector.get_columns("users"):
        if col["name"] == "id" and not isinstance(col["type"], postgresql.UUID):
            op.execute("ALTER TABLE users ALTER COLUMN id TYPE uuid USING id::uuid")
            break


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_table(inspector, "users"):
        return

    for col in inspector.get_columns("users"):
        if col["name"] == "id" and isinstance(col["type"], postgresql.UUID):
            op.execute("ALTER TABLE users ALTER COLUMN id TYPE varchar USING id::text")
            break
