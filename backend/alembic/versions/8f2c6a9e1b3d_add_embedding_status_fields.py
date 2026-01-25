"""Add embedding status fields to solutions.

Revision ID: 8f2c6a9e1b3d
Revises: 3b8c1a2f6b2d
Create Date: 2026-01-14 04:10:00
"""

from alembic import op
import sqlalchemy as sa


revision = "8f2c6a9e1b3d"
down_revision = "3b8c1a2f6b2d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "solutions",
        sa.Column("embedding_status", sa.String(), nullable=False, server_default=sa.text("'pending'")),
    )
    op.add_column("solutions", sa.Column("embedding_error", sa.Text(), nullable=True))
    op.add_column("solutions", sa.Column("embedding_updated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("solutions", "embedding_updated_at")
    op.drop_column("solutions", "embedding_error")
    op.drop_column("solutions", "embedding_status")
