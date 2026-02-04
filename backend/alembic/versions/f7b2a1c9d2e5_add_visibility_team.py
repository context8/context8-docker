"""Add team/private visibility and remove public flags.

Revision ID: f7b2a1c9d2e5
Revises: c5f2a9d1b8e7
Create Date: 2026-01-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "f7b2a1c9d2e5"
down_revision: Union[str, Sequence[str], None] = "c5f2a9d1b8e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_column(inspector, "solutions", "visibility"):
        with op.batch_alter_table("solutions") as batch_op:
            batch_op.add_column(
                sa.Column("visibility", sa.String(), nullable=False, server_default="private")
            )
            batch_op.create_check_constraint(
                "ck_solutions_visibility", "visibility in ('private','team')"
            )
            batch_op.create_index("ix_solutions_visibility", ["visibility"])

    if _has_column(inspector, "solutions", "is_public"):
        op.execute(
            """
            UPDATE solutions
            SET visibility = CASE
                WHEN is_public THEN 'team'
                ELSE 'private'
            END
            """
        )
        with op.batch_alter_table("solutions") as batch_op:
            batch_op.drop_column("is_public")

    if _has_column(inspector, "api_keys", "is_public"):
        with op.batch_alter_table("api_keys") as batch_op:
            batch_op.drop_column("is_public")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not _has_column(inspector, "solutions", "is_public"):
        with op.batch_alter_table("solutions") as batch_op:
            batch_op.add_column(
                sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false"))
            )
    if _has_column(inspector, "solutions", "visibility"):
        op.execute(
            """
            UPDATE solutions
            SET is_public = CASE
                WHEN visibility = 'team' THEN true
                ELSE false
            END
            """
        )
        with op.batch_alter_table("solutions") as batch_op:
            batch_op.drop_index("ix_solutions_visibility")
            batch_op.drop_constraint("ck_solutions_visibility", type_="check")
            batch_op.drop_column("visibility")

    if not _has_column(inspector, "api_keys", "is_public"):
        with op.batch_alter_table("api_keys") as batch_op:
            batch_op.add_column(
                sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false"))
            )
