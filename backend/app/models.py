from sqlalchemy import Column, String, Text, DateTime, JSON, Integer, CheckConstraint, Index, text
from sqlalchemy.sql import func
from .database import Base
from .visibility import VISIBILITY_PRIVATE


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
