import secrets
import hashlib
import uuid
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from fastapi import APIRouter, Depends, HTTPException
from .database import get_session, Base
from sqlalchemy import Column, String, DateTime, Boolean
from .auth import get_user_sub
from .users import User
from .models import Solution, SolutionVote
from .es import delete_solution_es
from .config import EMAIL_VERIFICATION_ENABLED


class ApiKey(Base):
    __tablename__ = "api_keys"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    key_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked = Column(Boolean, default=False)
    # No public visibility on keys; access is managed per-solution.


router = APIRouter(prefix="/apikeys", tags=["apikeys"])


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()

async def _cleanup_solutions_for_key(db: AsyncSession, key_id: str) -> None:
    res = await db.execute(select(Solution).where(Solution.api_key_id == key_id))
    items = res.scalars().all()
    if not items:
        return

    solution_ids = [item.id for item in items]
    await db.execute(delete(SolutionVote).where(SolutionVote.solution_id.in_(solution_ids)))
    await db.execute(delete(Solution).where(Solution.id.in_(solution_ids)))
    await db.commit()
    for sol_id in solution_ids:
        try:
            await delete_solution_es(sol_id)
        except Exception as exc:
            print(f"[apikeys] es delete failed for {sol_id}: {exc}")


@router.post("")
async def create_api_key(
    name: str,
    db: AsyncSession = Depends(get_session),
    user_id: str = Depends(get_user_sub),
):
    raw_key = secrets.token_urlsafe(32)
    hashed = hash_key(raw_key)
    key_id = secrets.token_hex(8)
    record = ApiKey(id=key_id, user_id=user_id, name=name, key_hash=hashed)
    db.add(record)
    await db.commit()
    return {"id": key_id, "apiKey": raw_key}


@router.get("")
async def list_api_keys(db: AsyncSession = Depends(get_session), user_id: str = Depends(get_user_sub)):
    res = await db.execute(select(ApiKey).where(ApiKey.user_id == user_id, ApiKey.revoked == False))
    items = res.scalars().all()
    return [{"id": i.id, "name": i.name, "createdAt": i.created_at} for i in items]


@router.delete("/{key_id}")
async def revoke_api_key(key_id: str, db: AsyncSession = Depends(get_session), user_id: str = Depends(get_user_sub)):
    res = await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == user_id))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    item.revoked = True
    await db.commit()
    await _cleanup_solutions_for_key(db, key_id)
    return {"status": "revoked"}


async def list_active_api_keys(db: AsyncSession, user_id: str) -> list[ApiKey]:
    res = await db.execute(
        select(ApiKey)
        .where(ApiKey.user_id == user_id, ApiKey.revoked == False)
        .order_by(ApiKey.created_at.asc())
    )
    return res.scalars().all()


async def resolve_api_keys(db: AsyncSession, raw_keys: list[str]) -> list[ApiKey]:
    if not raw_keys:
        return []

    hashes = [hash_key(key) for key in raw_keys]
    res = await db.execute(select(ApiKey).where(ApiKey.key_hash.in_(hashes)))
    items = [item for item in res.scalars().all() if not item.revoked]
    if not items:
        print("[auth] no active keys found")
        return []

    user_ids = {str(item.user_id) for item in items}
    valid_users: dict[str, User] = {}
    for user_id in user_ids:
        try:
            user_uuid = uuid.UUID(str(user_id))
        except Exception:
            print("[auth] user_id not a valid uuid")
            continue
        user_res = await db.execute(select(User).where(User.id == user_uuid))
        user = user_res.scalar_one_or_none()
        if not user:
            print(f"[auth] user missing for key user_id={user_id}")
            continue
        if EMAIL_VERIFICATION_ENABLED and not user.email_verified:
            print(f"[auth] user not verified email={user.email}")
            continue
        valid_users[str(user_uuid)] = user

    return [item for item in items if str(item.user_id) in valid_users]
