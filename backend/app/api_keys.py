import secrets
import hashlib
import uuid
from dataclasses import dataclass
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from fastapi import APIRouter, Depends, HTTPException, Body, Query
from .database import get_session, Base
from sqlalchemy import Column, String, DateTime, Boolean, Integer
from .auth import require_admin_user
from .users import User
from .models import Solution, SolutionVote
from .es import delete_solution_es, index_solution_es
from .es_docs import solution_to_es_doc
from .schemas import (
    ApiKeyCreate,
    ApiKeyLimitsUpdate,
    ApiKeyOut,
    SubApiKeyCreate,
    SubApiKeyOut,
    SubApiKeyUpdate,
)


class ApiKey(Base):
    __tablename__ = "api_keys"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    key_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked = Column(Boolean, default=False)
    daily_limit = Column(Integer, nullable=True)
    monthly_limit = Column(Integer, nullable=True)
    # No public visibility on keys; access is managed per-solution.


class SubApiKey(Base):
    __tablename__ = "sub_api_keys"
    id = Column(String, primary_key=True)
    parent_api_key_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False, index=True)
    name = Column(String, nullable=False)
    key_hash = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    revoked = Column(Boolean, default=False)
    can_read = Column(Boolean, default=True)
    can_write = Column(Boolean, default=True)
    daily_limit = Column(Integer, nullable=True)
    monthly_limit = Column(Integer, nullable=True)


router = APIRouter(prefix="/apikeys", tags=["apikeys"])


def hash_key(key: str) -> str:
    return hashlib.sha256(key.encode()).hexdigest()


@dataclass
class KeyScope:
    key_id: str
    api_key_id: str
    user_id: str
    is_sub: bool
    parent_id: str | None
    can_read: bool
    can_write: bool
    daily_limit: int | None
    monthly_limit: int | None

async def _cleanup_solutions_for_key(db: AsyncSession, key_id: str) -> None:
    res = await db.execute(select(Solution).where(Solution.api_key_id == key_id))
    items = res.scalars().all()
    if not items:
        return

    es_deleted_docs: list[tuple[str, dict]] = []
    for item in items:
        doc = solution_to_es_doc(item)
        try:
            await delete_solution_es(item.id)
        except Exception as exc:
            rollback_errors: list[str] = []
            for rollback_id, rollback_doc in es_deleted_docs:
                try:
                    await index_solution_es(rollback_id, rollback_doc)
                except Exception as rollback_exc:
                    rollback_errors.append(f"{rollback_id}: {rollback_exc}")
            if rollback_errors:
                raise HTTPException(
                    status_code=502,
                    detail=(
                        "Failed to delete ES docs during API key cleanup "
                        f"({item.id}: {exc}); ES rollback failed for {', '.join(rollback_errors)}"
                    ),
                ) from exc
            raise HTTPException(
                status_code=502,
                detail=f"Failed to delete ES docs during API key cleanup ({item.id}: {exc})",
            ) from exc
        es_deleted_docs.append((item.id, doc))

    solution_ids = [item.id for item in items]
    try:
        await db.execute(delete(SolutionVote).where(SolutionVote.solution_id.in_(solution_ids)))
        await db.execute(delete(Solution).where(Solution.id.in_(solution_ids)))
        await db.commit()
    except Exception as exc:
        await db.rollback()
        rollback_errors: list[str] = []
        for rollback_id, rollback_doc in es_deleted_docs:
            try:
                await index_solution_es(rollback_id, rollback_doc)
            except Exception as rollback_exc:
                rollback_errors.append(f"{rollback_id}: {rollback_exc}")
        if rollback_errors:
            raise HTTPException(
                status_code=500,
                detail=(
                    "Failed to remove DB rows during API key cleanup "
                    f"({exc}); ES rollback failed for {', '.join(rollback_errors)}"
                ),
            ) from exc
        raise HTTPException(
            status_code=500,
            detail=f"Failed to remove DB rows during API key cleanup ({exc}); ES rollback restored",
        ) from exc


def _normalize_permissions(can_read: bool | None, can_write: bool | None) -> tuple[bool, bool]:
    read = True if can_read is None else bool(can_read)
    write = True if can_write is None else bool(can_write)
    if write and not read:
        read = True
    if not read and not write:
        raise HTTPException(status_code=400, detail="At least one permission must be enabled")
    return read, write


@router.post("")
async def create_api_key(
    payload: ApiKeyCreate | None = Body(default=None),
    name: str | None = Query(default=None),
    daily_limit: int | None = Query(default=None, ge=0, alias="dailyLimit"),
    monthly_limit: int | None = Query(default=None, ge=0, alias="monthlyLimit"),
    db: AsyncSession = Depends(get_session),
    admin_user: User = Depends(require_admin_user),
):
    if payload:
        name = payload.name
        if payload.dailyLimit is not None:
            daily_limit = payload.dailyLimit
        if payload.monthlyLimit is not None:
            monthly_limit = payload.monthlyLimit

    if not name or not name.strip():
        raise HTTPException(status_code=400, detail="name is required")

    raw_key = secrets.token_urlsafe(32)
    hashed = hash_key(raw_key)
    key_id = secrets.token_hex(8)
    record = ApiKey(
        id=key_id,
        user_id=str(admin_user.id),
        name=name.strip(),
        key_hash=hashed,
        daily_limit=daily_limit,
        monthly_limit=monthly_limit,
    )
    db.add(record)
    await db.commit()
    return {
        "id": key_id,
        "apiKey": raw_key,
        "dailyLimit": daily_limit,
        "monthlyLimit": monthly_limit,
    }


@router.get("", response_model=list[ApiKeyOut])
async def list_api_keys(db: AsyncSession = Depends(get_session), admin_user: User = Depends(require_admin_user)):
    res = await db.execute(select(ApiKey).where(ApiKey.user_id == str(admin_user.id), ApiKey.revoked == False))
    items = res.scalars().all()
    return [
        {
            "id": i.id,
            "name": i.name,
            "createdAt": i.created_at,
            "dailyLimit": i.daily_limit,
            "monthlyLimit": i.monthly_limit,
        }
        for i in items
    ]


@router.patch("/{key_id}/limits", response_model=ApiKeyOut)
async def update_api_key_limits(
    key_id: str,
    payload: ApiKeyLimitsUpdate,
    db: AsyncSession = Depends(get_session),
    admin_user: User = Depends(require_admin_user),
):
    res = await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == str(admin_user.id)))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")

    fields = payload.model_fields_set
    if "dailyLimit" in fields:
        item.daily_limit = payload.dailyLimit
    if "monthlyLimit" in fields:
        item.monthly_limit = payload.monthlyLimit

    await db.commit()
    await db.refresh(item)
    return {
        "id": item.id,
        "name": item.name,
        "createdAt": item.created_at,
        "dailyLimit": item.daily_limit,
        "monthlyLimit": item.monthly_limit,
    }


@router.post("/{key_id}/subkeys", response_model=SubApiKeyOut)
async def create_sub_api_key(
    key_id: str,
    payload: SubApiKeyCreate,
    db: AsyncSession = Depends(get_session),
    admin_user: User = Depends(require_admin_user),
):
    if not payload.name or not payload.name.strip():
        raise HTTPException(status_code=400, detail="name is required")
    parent_res = await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == str(admin_user.id)))
    parent = parent_res.scalar_one_or_none()
    if not parent or parent.revoked:
        raise HTTPException(status_code=404, detail="Parent API key not found")

    can_read, can_write = _normalize_permissions(payload.canRead, payload.canWrite)
    raw_key = secrets.token_urlsafe(32)
    hashed = hash_key(raw_key)
    sub_id = secrets.token_hex(8)
    record = SubApiKey(
        id=sub_id,
        parent_api_key_id=parent.id,
        user_id=str(admin_user.id),
        name=payload.name.strip(),
        key_hash=hashed,
        can_read=can_read,
        can_write=can_write,
        daily_limit=payload.dailyLimit,
        monthly_limit=payload.monthlyLimit,
    )
    db.add(record)
    await db.commit()
    return {
        "id": sub_id,
        "parentId": parent.id,
        "name": record.name,
        "createdAt": record.created_at,
        "apiKey": raw_key,
        "canRead": record.can_read,
        "canWrite": record.can_write,
        "dailyLimit": record.daily_limit,
        "monthlyLimit": record.monthly_limit,
    }


@router.get("/{key_id}/subkeys", response_model=list[SubApiKeyOut])
async def list_sub_api_keys(
    key_id: str,
    db: AsyncSession = Depends(get_session),
    admin_user: User = Depends(require_admin_user),
):
    parent_res = await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == str(admin_user.id)))
    parent = parent_res.scalar_one_or_none()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent API key not found")

    res = await db.execute(
        select(SubApiKey)
        .where(
            SubApiKey.parent_api_key_id == parent.id,
            SubApiKey.user_id == str(admin_user.id),
            SubApiKey.revoked == False,
        )
        .order_by(SubApiKey.created_at.asc())
    )
    items = res.scalars().all()
    return [
        {
            "id": i.id,
            "parentId": i.parent_api_key_id,
            "name": i.name,
            "createdAt": i.created_at,
            "canRead": i.can_read,
            "canWrite": i.can_write,
            "dailyLimit": i.daily_limit,
            "monthlyLimit": i.monthly_limit,
        }
        for i in items
    ]


@router.patch("/{key_id}/subkeys/{sub_id}", response_model=SubApiKeyOut)
async def update_sub_api_key(
    key_id: str,
    sub_id: str,
    payload: SubApiKeyUpdate,
    db: AsyncSession = Depends(get_session),
    admin_user: User = Depends(require_admin_user),
):
    parent_res = await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == str(admin_user.id)))
    parent = parent_res.scalar_one_or_none()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent API key not found")

    res = await db.execute(
        select(SubApiKey).where(
            SubApiKey.id == sub_id,
            SubApiKey.parent_api_key_id == parent.id,
            SubApiKey.user_id == str(admin_user.id),
        )
    )
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Sub API key not found")

    if payload.name is not None:
        if not payload.name.strip():
            raise HTTPException(status_code=400, detail="name is required")
        item.name = payload.name.strip()

    can_read = payload.canRead if "canRead" in payload.model_fields_set else None
    can_write = payload.canWrite if "canWrite" in payload.model_fields_set else None
    if can_read is not None or can_write is not None:
        read_val, write_val = _normalize_permissions(
            can_read if can_read is not None else item.can_read,
            can_write if can_write is not None else item.can_write,
        )
        item.can_read = read_val
        item.can_write = write_val

    if "dailyLimit" in payload.model_fields_set:
        item.daily_limit = payload.dailyLimit
    if "monthlyLimit" in payload.model_fields_set:
        item.monthly_limit = payload.monthlyLimit

    await db.commit()
    await db.refresh(item)
    return {
        "id": item.id,
        "parentId": item.parent_api_key_id,
        "name": item.name,
        "createdAt": item.created_at,
        "canRead": item.can_read,
        "canWrite": item.can_write,
        "dailyLimit": item.daily_limit,
        "monthlyLimit": item.monthly_limit,
    }


@router.delete("/{key_id}/subkeys/{sub_id}")
async def revoke_sub_api_key(
    key_id: str,
    sub_id: str,
    db: AsyncSession = Depends(get_session),
    admin_user: User = Depends(require_admin_user),
):
    parent_res = await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == str(admin_user.id)))
    parent = parent_res.scalar_one_or_none()
    if not parent:
        raise HTTPException(status_code=404, detail="Parent API key not found")

    res = await db.execute(
        select(SubApiKey).where(
            SubApiKey.id == sub_id,
            SubApiKey.parent_api_key_id == parent.id,
            SubApiKey.user_id == str(admin_user.id),
        )
    )
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Sub API key not found")
    item.revoked = True
    await db.commit()
    return {"status": "revoked"}


@router.delete("/{key_id}")
async def revoke_api_key(key_id: str, db: AsyncSession = Depends(get_session), admin_user: User = Depends(require_admin_user)):
    res = await db.execute(select(ApiKey).where(ApiKey.id == key_id, ApiKey.user_id == str(admin_user.id)))
    item = res.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Not found")
    await _cleanup_solutions_for_key(db, key_id)
    item.revoked = True
    await db.commit()
    return {"status": "revoked"}


async def list_active_api_keys(db: AsyncSession, user_id: str) -> list[ApiKey]:
    res = await db.execute(
        select(ApiKey)
        .where(ApiKey.user_id == user_id, ApiKey.revoked == False)
        .order_by(ApiKey.created_at.asc())
    )
    return res.scalars().all()


async def list_active_sub_api_keys(db: AsyncSession, parent_ids: list[str]) -> list[SubApiKey]:
    if not parent_ids:
        return []
    res = await db.execute(
        select(SubApiKey)
        .where(
            SubApiKey.parent_api_key_id.in_(parent_ids),
            SubApiKey.revoked == False,
        )
        .order_by(SubApiKey.created_at.asc())
    )
    return res.scalars().all()


async def resolve_api_keys(db: AsyncSession, raw_keys: list[str]) -> list[KeyScope]:
    if not raw_keys:
        return []

    hashes = [hash_key(key) for key in raw_keys]
    api_res = await db.execute(select(ApiKey).where(ApiKey.key_hash.in_(hashes)))
    api_items = [item for item in api_res.scalars().all() if not item.revoked]
    api_by_hash = {item.key_hash: item for item in api_items}

    sub_res = await db.execute(
        select(SubApiKey, ApiKey)
        .where(
            SubApiKey.key_hash.in_(hashes),
            SubApiKey.revoked == False,
            SubApiKey.parent_api_key_id == ApiKey.id,
            ApiKey.revoked == False,
        )
    )
    sub_by_hash: dict[str, SubApiKey] = {}
    for sub_item, parent in sub_res.all():
        sub_by_hash[sub_item.key_hash] = sub_item

    scopes: list[KeyScope] = []
    for raw_key, key_hash in zip(raw_keys, hashes):
        if key_hash in sub_by_hash and key_hash in api_by_hash:
            print("[auth] key hash collision between api and sub keys")
            continue
        if key_hash in sub_by_hash:
            sub_item = sub_by_hash[key_hash]
            scopes.append(
                KeyScope(
                    key_id=sub_item.id,
                    api_key_id=sub_item.id,
                    user_id=str(sub_item.user_id),
                    is_sub=True,
                    parent_id=str(sub_item.parent_api_key_id),
                    can_read=bool(sub_item.can_read),
                    can_write=bool(sub_item.can_write),
                    daily_limit=sub_item.daily_limit,
                    monthly_limit=sub_item.monthly_limit,
                )
            )
            continue
        if key_hash in api_by_hash:
            item = api_by_hash[key_hash]
            scopes.append(
                KeyScope(
                    key_id=item.id,
                    api_key_id=item.id,
                    user_id=str(item.user_id),
                    is_sub=False,
                    parent_id=None,
                    can_read=True,
                    can_write=True,
                    daily_limit=item.daily_limit,
                    monthly_limit=item.monthly_limit,
                )
            )
            continue

    if not scopes:
        print("[auth] no active keys found")
        return []

    user_ids = {scope.user_id for scope in scopes}
    valid_users: set[str] = set()
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
        valid_users.add(str(user_uuid))

    return [scope for scope in scopes if scope.user_id in valid_users]
