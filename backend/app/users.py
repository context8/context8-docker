from datetime import datetime
from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.dialects.postgresql import CITEXT, UUID
from .database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(UUID(as_uuid=True), primary_key=True)
    username = Column(String, nullable=False)
    email = Column(CITEXT, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False, server_default="")
    email_verified = Column(Boolean, nullable=False, server_default='false')
    is_admin = Column(Boolean, nullable=False, server_default='false')
    created_at = Column(DateTime, default=datetime.utcnow)
