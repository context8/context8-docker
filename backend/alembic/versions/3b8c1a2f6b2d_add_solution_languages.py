"""Add conversation/programming language fields to solutions.

Revision ID: 3b8c1a2f6b2d
Revises: da16b97d5c07
Create Date: 2026-01-13 22:40:00
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "3b8c1a2f6b2d"
down_revision = "da16b97d5c07"
branch_labels = None
depends_on = None


def _has_column(inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    if not _has_column(inspector, "solutions", "conversation_language"):
        op.add_column("solutions", sa.Column("conversation_language", sa.String(), nullable=True))
    if not _has_column(inspector, "solutions", "programming_language"):
        op.add_column("solutions", sa.Column("programming_language", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("solutions", "programming_language")
    op.drop_column("solutions", "conversation_language")
