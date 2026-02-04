"""Bootstrap Context8 schema with auth, API keys, solutions, and embeddings.

Revision ID: da16b97d5c07
Revises:
Create Date: 2025-11-25 15:09:18.022081
"""
from typing import Sequence, Union
import os
import hashlib
import secrets

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import CITEXT, JSON
from pgvector.sqlalchemy import Vector

# revision identifiers, used by Alembic.
revision: str = "da16b97d5c07"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Keep in sync with app.models.EMBEDDING_DIM
EMBEDDING_DIM = int(os.environ.get("EMBEDDING_DIM", "384"))


def _has_table(inspector, name: str) -> bool:
    return inspector.has_table(name)


def _has_column(inspector, table: str, column: str) -> bool:
    return any(col["name"] == column for col in inspector.get_columns(table))


def _has_index(inspector, table: str, index_name: str) -> bool:
    return any(idx.get("name") == index_name for idx in inspector.get_indexes(table))


def upgrade() -> None:
    """Create baseline schema if missing; safe to run on a fresh database."""
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # Extensions
    op.execute("CREATE EXTENSION IF NOT EXISTS citext")
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    # users
    if not _has_table(inspector, "users"):
        op.create_table(
            "users",
            sa.Column("id", sa.String(), primary_key=True),
            sa.Column("email", CITEXT(), nullable=False, unique=True, index=True),
            sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        )
    else:
        if not _has_column(inspector, "users", "email_verified"):
            op.add_column("users", sa.Column("email_verified", sa.Boolean(), nullable=False, server_default=sa.text("false")))
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
            sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        )
    else:
        if not _has_column(inspector, "api_keys", "is_public"):
            op.add_column("api_keys", sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false")))

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
            sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("project_path", sa.String(), nullable=True),
            sa.Column("environment", JSON(), nullable=True),
            sa.Column("embedding", Vector(EMBEDDING_DIM), nullable=True),
        )
        if not _has_index(inspector, "solutions", "ix_solutions_user_id"):
            op.create_index("ix_solutions_user_id", "solutions", ["user_id"])
        if not _has_index(inspector, "solutions", "ix_solutions_api_key_id"):
            op.create_index("ix_solutions_api_key_id", "solutions", ["api_key_id"])
        if not _has_index(inspector, "solutions", "ix_solutions_created_at"):
            op.create_index("ix_solutions_created_at", "solutions", ["created_at"])
    else:
        if not _has_column(inspector, "solutions", "api_key_id"):
            op.add_column("solutions", sa.Column("api_key_id", sa.String(), nullable=True))
        op.execute("CREATE INDEX IF NOT EXISTS ix_solutions_api_key_id ON solutions (api_key_id)")
        if not _has_column(inspector, "solutions", "is_public"):
            op.add_column("solutions", sa.Column("is_public", sa.Boolean(), nullable=False, server_default=sa.text("false")))

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
                    INSERT INTO api_keys (id, user_id, name, key_hash, created_at, revoked, is_public)
                    VALUES (:id, :user_id, :name, :key_hash, now(), false, false)
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

    # verification_codes
    if not _has_table(inspector, "verification_codes"):
        op.create_table(
            "verification_codes",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("email", CITEXT(), nullable=False),
            sa.Column("code_hash", sa.String(64), nullable=False),
            sa.Column("salt", sa.String(32), nullable=False),
            sa.Column("verified", sa.Boolean(), nullable=False, server_default=sa.text("false")),
            sa.Column("failed_attempts", sa.Integer(), nullable=False, server_default=sa.text("0")),
            sa.Column("locked_until", sa.DateTime(timezone=True), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("ip_address", sa.String(), nullable=True),
            sa.PrimaryKeyConstraint("id"),
            sa.CheckConstraint("code_hash ~ '^[a-f0-9]{64}$'", name="code_hash_format"),
        )
        op.create_index("ix_verification_codes_email", "verification_codes", ["email"])
        op.create_index("ix_verification_codes_email_verified", "verification_codes", ["email", "verified"])
        op.create_index("ix_verification_codes_created_at", "verification_codes", ["created_at"])

    # auth_audit_log
    if not _has_table(inspector, "auth_audit_log"):
        op.create_table(
            "auth_audit_log",
            sa.Column("id", sa.String(), nullable=False),
            sa.Column("email", CITEXT(), nullable=False),
            sa.Column("event_type", sa.String(), nullable=False),
            sa.Column("ip_address", sa.String(), nullable=True),
            sa.Column("user_agent", sa.String(), nullable=True),
            sa.Column("success", sa.Boolean(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
            sa.PrimaryKeyConstraint("id"),
        )
        op.create_index("ix_auth_audit_log_email_created_at", "auth_audit_log", ["email", "created_at"])
        op.create_index("ix_auth_audit_log_event_type", "auth_audit_log", ["event_type"])


def downgrade() -> None:
    """Drop all Context8 tables (unsafe; for development rollback only)."""
    op.execute("DROP INDEX IF EXISTS ix_auth_audit_log_event_type")
    op.execute("DROP INDEX IF EXISTS ix_auth_audit_log_email_created_at")
    op.execute("DROP TABLE IF EXISTS auth_audit_log")

    op.execute("DROP INDEX IF EXISTS ix_verification_codes_created_at")
    op.execute("DROP INDEX IF EXISTS ix_verification_codes_email_verified")
    op.execute("DROP INDEX IF EXISTS ix_verification_codes_email")
    op.execute("DROP TABLE IF EXISTS verification_codes")

    op.execute("DROP INDEX IF EXISTS ix_solutions_created_at")
    op.execute("DROP INDEX IF EXISTS ix_solutions_api_key_id")
    op.execute("DROP INDEX IF EXISTS ix_solutions_user_id")
    op.execute("DROP TABLE IF EXISTS solutions")

    op.execute("DROP TABLE IF EXISTS api_keys")

    # Users kept last to avoid FK issues when added later
    op.execute("DROP TABLE IF EXISTS users")

    op.execute("DROP EXTENSION IF EXISTS vector")
    op.execute("DROP EXTENSION IF EXISTS citext")
