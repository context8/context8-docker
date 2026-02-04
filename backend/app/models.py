from sqlalchemy import Column, String, Text, DateTime, JSON, Integer, Boolean, CheckConstraint, Index, text
from sqlalchemy.sql import func
from sqlalchemy.dialects.postgresql import CITEXT
from pgvector.sqlalchemy import Vector
from .database import Base
from .visibility import VISIBILITY_PRIVATE
import os

EMBEDDING_DIM = int(os.environ.get("EMBEDDING_DIM", "384"))


class Solution(Base):
    __tablename__ = "solutions"

    id = Column(String, primary_key=True, index=True)
    user_id = Column(String, nullable=False, index=True)
    api_key_id = Column(String, nullable=False, index=True)
    title = Column(Text, nullable=False)
    error_message = Column(Text, nullable=False)
    error_type = Column(String, nullable=False)
    context = Column(Text, nullable=False)
    root_cause = Column(Text, nullable=False)
    solution = Column(Text, nullable=False)
    code_changes = Column(Text, nullable=True)
    tags = Column(JSON, nullable=False)
    conversation_language = Column(String, nullable=True)
    programming_language = Column(String, nullable=True)
    vibecoding_software = Column(String, nullable=True)
    visibility = Column(String, nullable=False, server_default=text(f"'{VISIBILITY_PRIVATE}'"))
    upvotes = Column(Integer, nullable=False, server_default=text("0"))
    downvotes = Column(Integer, nullable=False, server_default=text("0"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    project_path = Column(String, nullable=True)
    environment = Column(JSON, nullable=True)
    embedding = Column(Vector(EMBEDDING_DIM), nullable=True)
    embedding_status = Column(String, nullable=False, server_default=text("'pending'"))
    embedding_error = Column(Text, nullable=True)
    embedding_updated_at = Column(DateTime(timezone=True), nullable=True)

    __table_args__ = (
        CheckConstraint("upvotes >= 0", name="ck_solutions_upvotes_nonnegative"),
        CheckConstraint("downvotes >= 0", name="ck_solutions_downvotes_nonnegative"),
        CheckConstraint("visibility in ('private', 'team')", name="ck_solutions_visibility"),
        Index("ix_solutions_upvotes", "upvotes"),
        Index("ix_solutions_downvotes", "downvotes"),
        Index("ix_solutions_visibility", "visibility"),
    )


class SolutionVote(Base):
    __tablename__ = "solution_votes"

    id = Column(String, primary_key=True)
    solution_id = Column(String, nullable=False)
    user_id = Column(String, nullable=False)
    value = Column(Integer, nullable=False)  # +1 / -1
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("value in (1, -1)", name="ck_solution_votes_value"),
        Index("ix_solution_votes_solution_user", "solution_id", "user_id", unique=True),
        Index("ix_solution_votes_solution_id", "solution_id"),
        Index("ix_solution_votes_user_id", "user_id"),
    )


class VerificationCode(Base):
    __tablename__ = "verification_codes"

    id = Column(String, primary_key=True)
    email = Column(CITEXT, nullable=False, index=True)
    code_hash = Column(String(64), nullable=False)
    salt = Column(String(32), nullable=False)
    verified = Column(Boolean, nullable=False, default=False)
    failed_attempts = Column(Integer, nullable=False, default=0)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    ip_address = Column(String, nullable=True)

    __table_args__ = (
        CheckConstraint("code_hash ~ '^[a-f0-9]{64}$'", name='code_hash_format'),
        Index('ix_verification_codes_email_verified', 'email', 'verified'),
        Index('ix_verification_codes_created_at', 'created_at'),
    )


class AuthAuditLog(Base):
    __tablename__ = "auth_audit_log"

    id = Column(String, primary_key=True)
    email = Column(CITEXT, nullable=False, index=True)
    event_type = Column(String, nullable=False)  # 'code_sent', 'verify_success', 'verify_failed', 'locked'
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    success = Column(Boolean, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        Index('ix_auth_audit_log_email_created_at', 'email', 'created_at'),
        Index('ix_auth_audit_log_event_type', 'event_type'),
    )
