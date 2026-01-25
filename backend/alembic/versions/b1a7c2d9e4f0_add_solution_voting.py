"""Add StackOverflow-style voting for solutions.

Revision ID: b1a7c2d9e4f0
Revises: 8f2c6a9e1b3d
Create Date: 2026-01-21 00:00:00
"""

from alembic import op
import sqlalchemy as sa


revision = "b1a7c2d9e4f0"
down_revision = "8f2c6a9e1b3d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "solutions",
        sa.Column("upvotes", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.add_column(
        "solutions",
        sa.Column("downvotes", sa.Integer(), nullable=False, server_default=sa.text("0")),
    )
    op.create_check_constraint("ck_solutions_upvotes_nonnegative", "solutions", "upvotes >= 0")
    op.create_check_constraint("ck_solutions_downvotes_nonnegative", "solutions", "downvotes >= 0")
    op.create_index("ix_solutions_upvotes", "solutions", ["upvotes"])
    op.create_index("ix_solutions_downvotes", "solutions", ["downvotes"])

    op.create_table(
        "solution_votes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("solution_id", sa.String(), nullable=False),
        sa.Column("user_id", sa.String(), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("value in (1, -1)", name="ck_solution_votes_value"),
    )
    op.create_index("ix_solution_votes_solution_user", "solution_votes", ["solution_id", "user_id"], unique=True)
    op.create_index("ix_solution_votes_solution_id", "solution_votes", ["solution_id"])
    op.create_index("ix_solution_votes_user_id", "solution_votes", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_solution_votes_user_id", table_name="solution_votes")
    op.drop_index("ix_solution_votes_solution_id", table_name="solution_votes")
    op.drop_index("ix_solution_votes_solution_user", table_name="solution_votes")
    op.drop_table("solution_votes")

    op.drop_index("ix_solutions_downvotes", table_name="solutions")
    op.drop_index("ix_solutions_upvotes", table_name="solutions")
    op.drop_constraint("ck_solutions_downvotes_nonnegative", "solutions", type_="check")
    op.drop_constraint("ck_solutions_upvotes_nonnegative", "solutions", type_="check")
    op.drop_column("solutions", "downvotes")
    op.drop_column("solutions", "upvotes")
