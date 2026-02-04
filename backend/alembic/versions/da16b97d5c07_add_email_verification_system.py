"""Bootstrap Context8 schema with users, API keys, and solutions.

Revision ID: da16b97d5c07
Revises:
Create Date: 2025-11-25 15:09:18.022081
"""
from typing import Sequence, Union
import hashlib
import secrets

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import CITEXT, JSON, UUID

# revision identifiers, used by Alembic.
revision: str = "da16b97d5c07"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def _has_table(inspector, name: str) -> bool:
    return inspector.has_table(name)


def _has_column(inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def _has_index(inspector, table: str, index_name: str) -> bool:
    return any(idx.get("name") == index_name for idx in inspector.get_indexes(table))

def _has_check(inspector, table: str, name: str) -> bool:
    return any(item.get("name") == name for item in inspector.get_check_constraints(table))


def upgrade() -> None:
    """Create baseline schema if missing; safe to run on a fresh database."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")

    # users
    if not _has_table(inspector, "users"):
        op.create_table(
            "users",
            sa.Column("id", UUID(as_uuid=True), primary_key=True),
            sa.Column("username", sa.String(), nullable=False),
            sa.Column("email", CITEXT(), nullable=False, unique=True, index=True),
            sa.Column("password", sa.String(), nullable=False, server_default=""),
            sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
    else:
        if not _has_column(inspector, "users", "username"):
            op.add_column("users", sa.Column("username", sa.String(), nullable=True))
            op.execute("UPDATE users SET username = email WHERE username IS NULL OR username = ''")
            op.execute("ALTER TABLE users ALTER COLUMN username SET NOT NULL")
        if not _has_column(inspector, "users", "password"):
            op.add_column("users", sa.Column("password", sa.String(), nullable=False, server_default=""))
            op.execute("UPDATE users SET password = '' WHERE password IS NULL")
        if not _has_column(inspector, "users", "is_admin"):
            op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")))
        if not _has_column(inspector, "users", "email_verified"):
            op.add_column("users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")))
        if not _has_column(inspector, "users", "created_at"):
            op.add_column("users", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False))
        op.execute("ALTER TABLE users ALTER COLUMN email TYPE citext")
        op.execute("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_key")
        op.create_unique_constraint("users_email_key", "users", ["email"])

    # api_keys
    if not _has_table(inspector, "api_keys"):
        op.create_table(
            "api_keys",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("user_id", sa.String(), nullable=False, index=True),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("key_hash", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("revoked", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )

    # solutions
    if not _has_table(inspector, "solutions"):
        op.create_table(
            "solutions",
            sa.Column("id", sa.String(), primary_key=True, index=True),
            sa.Column("user_id", sa.String(), nullable=False, index=True),
            sa.Column("api_key_id", sa.String(), nullable=False, index=True),
            sa.Column("title", sa.Text(), nullable=False),
            sa.Column("error_message", sa.Text(), nullable=False),
            sa.Column("error_type", sa.String(), nullable=False),
            sa.Column("context", sa.Text(), nullable=False),
            sa.Column("root_cause", sa.Text(), nullable=False),
            sa.Column("solution", sa.Text(), nullable=False),
            sa.Column("code_changes", sa.Text(), nullable=True),
            sa.Column("tags", JSON(), nullable=False),
            sa.Column("conversation_language", sa.String(), nullable=True),
            sa.Column("programming_language", sa.String(), nullable=True),
            sa.Column("vibecoding_software", sa.String(), nullable=True),
            sa.Column("visibility", sa.String(), nullable=False, server_default=sa.text("'private'")),
            sa.Column("upvotes", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("downvotes", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("project_path", sa.String(), nullable=True),
            sa.Column("environment", JSON(), nullable=True),
            sa.Column("embedding_status", sa.String(), nullable=False, server_default=sa.text("'pending'")),
            sa.Column("embedding_error", sa.Text(), nullable=True),
            sa.Column("embedding_updated_at", sa.DateTime(timezone=True), nullable=True),
        )
        if not _has_index(inspector, "solutions", "ix_solutions_user_id"):
            op.create_index("ix_solutions_user_id", "solutions", ["user_id"])
        if not _has_index(inspector, "solutions", "ix_solutions_api_key_id"):
            op.create_index("ix_solutions_api_key_id", "solutions", ["api_key_id"])
        if not _has_index(inspector, "solutions", "ix_solutions_created_at"):
            op.create_index("ix_solutions_created_at", "solutions", ["created_at"])
        if not _has_index(inspector, "solutions", "ix_solutions_upvotes"):
            op.create_index("ix_solutions_upvotes", "solutions", ["upvotes"])
        if not _has_index(inspector, "solutions", "ix_solutions_downvotes"):
            op.create_index("ix_solutions_downvotes", "solutions", ["downvotes"])
        if not _has_index(inspector, "solutions", "ix_solutions_visibility"):
            op.create_index("ix_solutions_visibility", "solutions", ["visibility"])
        if not _has_check(inspector, "solutions", "ck_solutions_upvotes_nonnegative"):
            op.create_check_constraint("ck_solutions_upvotes_nonnegative", "solutions", "upvotes >= 0")
        if not _has_check(inspector, "solutions", "ck_solutions_downvotes_nonnegative"):
            op.create_check_constraint("ck_solutions_downvotes_nonnegative", "solutions", "downvotes >= 0")
        if not _has_check(inspector, "solutions", "ck_solutions_visibility"):
            op.create_check_constraint("ck_solutions_visibility", "solutions", "visibility in ('private', 'team')")
    else:
        if not _has_column(inspector, "solutions", "api_key_id"):
            op.add_column("solutions", sa.Column("api_key_id", sa.String(), nullable=True))
        op.execute("CREATE INDEX IF NOT EXISTS ix_solutions_api_key_id ON solutions (api_key_id)")
        if not _has_column(inspector, "solutions", "conversation_language"):
            op.add_column("solutions", sa.Column("conversation_language", sa.String(), nullable=True))
        if not _has_column(inspector, "solutions", "programming_language"):
            op.add_column("solutions", sa.Column("programming_language", sa.String(), nullable=True))
        if not _has_column(inspector, "solutions", "vibecoding_software"):
            op.add_column("solutions", sa.Column("vibecoding_software", sa.String(), nullable=True))
        if not _has_column(inspector, "solutions", "visibility"):
            op.add_column("solutions", sa.Column("visibility", sa.String(), nullable=False, server_default=sa.text("'private'")))
            op.execute("UPDATE solutions SET visibility = 'private' WHERE visibility IS NULL")
        if not _has_column(inspector, "solutions", "upvotes"):
            op.add_column("solutions", sa.Column("upvotes", sa.Integer(), nullable=False, server_default=sa.text("0")))
            op.execute("UPDATE solutions SET upvotes = 0 WHERE upvotes IS NULL")
        if not _has_column(inspector, "solutions", "downvotes"):
            op.add_column("solutions", sa.Column("downvotes", sa.Integer(), nullable=False, server_default=sa.text("0")))
            op.execute("UPDATE solutions SET downvotes = 0 WHERE downvotes IS NULL")
        if not _has_column(inspector, "solutions", "embedding_status"):
            op.add_column("solutions", sa.Column("embedding_status", sa.String(), nullable=False, server_default=sa.text("'pending'")))
        if not _has_column(inspector, "solutions", "embedding_error"):
            op.add_column("solutions", sa.Column("embedding_error", sa.Text(), nullable=True))
        if not _has_column(inspector, "solutions", "embedding_updated_at"):
            op.add_column("solutions", sa.Column("embedding_updated_at", sa.DateTime(timezone=True), nullable=True))

        if not _has_index(inspector, "solutions", "ix_solutions_upvotes"):
            op.create_index("ix_solutions_upvotes", "solutions", ["upvotes"])
        if not _has_index(inspector, "solutions", "ix_solutions_downvotes"):
            op.create_index("ix_solutions_downvotes", "solutions", ["downvotes"])
        if not _has_index(inspector, "solutions", "ix_solutions_visibility"):
            op.create_index("ix_solutions_visibility", "solutions", ["visibility"])
        if not _has_check(inspector, "solutions", "ck_solutions_upvotes_nonnegative"):
            op.create_check_constraint("ck_solutions_upvotes_nonnegative", "solutions", "upvotes >= 0")
        if not _has_check(inspector, "solutions", "ck_solutions_downvotes_nonnegative"):
            op.create_check_constraint("ck_solutions_downvotes_nonnegative", "solutions", "downvotes >= 0")
        if not _has_check(inspector, "solutions", "ck_solutions_visibility"):
            op.create_check_constraint("ck_solutions_visibility", "solutions", "visibility in ('private', 'team')")

        conn = op.get_bind()
        conn.execute(sa.text("""
            UPDATE solutions s
            SET api_key_id = (
                SELECT id
                FROM api_keys k
                WHERE k.user_id = s.user_id AND k.revoked = false
                ORDER BY k.created_at ASC
                LIMIT 1
            )
            WHERE s.api_key_id IS NULL
        """))

        rows = conn.execute(sa.text("""
            SELECT DISTINCT s.user_id
            FROM solutions s
            LEFT JOIN api_keys k ON k.user_id = s.user_id AND k.revoked = false
            WHERE s.api_key_id IS NULL AND k.id IS NULL
        """)).fetchall()
        for (user_id,) in rows:
            raw_key = secrets.token_urlsafe(32)
            key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
            key_id = secrets.token_hex(8)
            conn.execute(
                sa.text("""
                    INSERT INTO api_keys (id, user_id, name, key_hash, created_at, revoked)
                    VALUES (:id, :user_id, :name, :key_hash, now(), false)
                """),
                {"id": key_id, "user_id": user_id, "name": "default", "key_hash": key_hash},
            )

        conn.execute(sa.text("""
            UPDATE solutions s
            SET api_key_id = (
                SELECT id
                FROM api_keys k
                WHERE k.user_id = s.user_id AND k.revoked = false
                ORDER BY k.created_at ASC
                LIMIT 1
            )
            WHERE s.api_key_id IS NULL
        """))

        remaining = conn.execute(sa.text("SELECT count(*) FROM solutions WHERE api_key_id IS NULL")).scalar()
        if remaining == 0:
            op.execute("ALTER TABLE solutions ALTER COLUMN api_key_id SET NOT NULL")

def downgrade() -> None:
    """Drop all Context8 tables (unsafe; for development rollback only)."""
    op.execute("DROP INDEX IF EXISTS ix_solutions_created_at")
    op.execute("DROP INDEX IF EXISTS ix_solutions_api_key_id")
    op.execute("DROP INDEX IF EXISTS ix_solutions_user_id")
    op.execute("DROP TABLE IF EXISTS solutions")

    op.execute("DROP TABLE IF EXISTS api_keys")

    # Users kept last to avoid FK issues when added later
    op.execute("DROP TABLE IF EXISTS users")
    op.execute("DROP EXTENSION IF EXISTS citext")
