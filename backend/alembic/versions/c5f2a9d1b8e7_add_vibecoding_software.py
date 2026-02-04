"""Add vibecoding_software to solutions.

Revision ID: c5f2a9d1b8e7
Revises: b1a7c2d9e4f0
Create Date: 2026-01-23 03:45:00
"""

from alembic import op
import sqlalchemy as sa


revision = "c5f2a9d1b8e7"
down_revision = "b1a7c2d9e4f0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("solutions", sa.Column("vibecoding_software", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("solutions", "vibecoding_software")
