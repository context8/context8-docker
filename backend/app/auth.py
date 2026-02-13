import uuid
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException, status
from jose import JWTError, jwt
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from passlib.context import CryptContext

from .config import JWT_ALG, JWT_SECRET
from .database import get_session
from .users import User


SESSION_EXPIRY_DAYS = 7
JWT_ISSUER = "context8.com"
JWT_AUDIENCE = "context8-api"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class UserResponse(BaseModel):
    id: str
    username: str | None = None
    email: str
    emailVerified: bool = True
    isAdmin: bool = False


class SessionResponse(BaseModel):
    token: str
    user: UserResponse


class AdminSetupRequest(BaseModel):
    username: str
    password: str
    email: str | None = None


class LoginRequest(BaseModel):
    identifier: str
    password: str


class AdminPasswordResetRequest(BaseModel):
    identifier: str
    newPassword: str


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(password, password_hash)
    except Exception:
        return False


def sign_session_token(user_id: str | uuid.UUID, email: str, is_admin: bool = False) -> str:
    exp = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
    payload = {
        "sub": str(user_id),
        "email": email,
        "exp": exp,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "is_admin": bool(is_admin),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


async def ensure_user(db: AsyncSession, user_id: str) -> User:
    try:
        user_uuid = uuid.UUID(str(user_id))
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized") from exc

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    return user


async def admin_exists(db: AsyncSession) -> bool:
    res = await db.execute(select(func.count()).select_from(User).where(User.is_admin == True))
    return (res.scalar() or 0) > 0


async def setup_admin(request: AdminSetupRequest, db: AsyncSession) -> SessionResponse:
    if await admin_exists(db):
        raise HTTPException(status_code=409, detail="Admin already exists")

    username = request.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if len(request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    email = (request.email or username).strip()
    password_hash = hash_password(request.password)

    existing = await db.execute(select(User).where(or_(User.username == username, User.email == email)))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="User already exists")

    user = User(
        id=uuid.uuid4(),
        username=username,
        email=email,
        password=password_hash,
        email_verified=True,
        is_admin=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    session_token = sign_session_token(user.id, user.email, True)
    return SessionResponse(
        token=session_token,
        user=UserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            emailVerified=True,
            isAdmin=True,
        ),
    )


async def reset_admin_password(payload: AdminPasswordResetRequest, db: AsyncSession) -> None:
    identifier = payload.identifier.strip()
    if not identifier:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Identifier is required")
    if len(payload.newPassword) < 8:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Password must be at least 8 characters")

    result = await db.execute(
        select(User).where(
            User.is_admin == True,
            or_(User.username == identifier, User.email == identifier),
        )
    )
    admin_user = result.scalar_one_or_none()
    if not admin_user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Admin user not found")

    admin_user.password = hash_password(payload.newPassword)
    await db.commit()


async def login(request: LoginRequest, db: AsyncSession) -> SessionResponse:
    identifier = request.identifier.strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Identifier is required")

    res = await db.execute(select(User).where(or_(User.username == identifier, User.email == identifier)))
    user = res.scalar_one_or_none()
    if not user or not user.password or not verify_password(request.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    session_token = sign_session_token(user.id, user.email, bool(user.is_admin))
    return SessionResponse(
        token=session_token,
        user=UserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            emailVerified=True,
            isAdmin=bool(user.is_admin),
        ),
    )


def verify_session_token(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1]

    try:
        return jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALG],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
        )
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {exc}") from exc


def get_user_sub(payload=Depends(verify_session_token)) -> str:
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")
    return user_id


async def require_admin_user(
    payload=Depends(verify_session_token),
    db: AsyncSession = Depends(get_session),
) -> User:
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    user = await ensure_user(db, user_id)
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
