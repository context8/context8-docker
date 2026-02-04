import secrets
import hashlib
import httpx
import uuid
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException, status, Header, Request
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from pydantic import BaseModel, EmailStr
from passlib.context import CryptContext
from .database import get_session
from .models import VerificationCode, AuthAuditLog
from .users import User
from .config import RESEND_API_KEY, RESEND_FROM, JWT_SECRET, JWT_ALG, EMAIL_VERIFICATION_ENABLED


# Constants
CODE_EXPIRY_MINUTES = 10
SESSION_EXPIRY_DAYS = 7
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_MINUTES = 10
RATE_LIMIT_EMAIL_SECONDS = 60
RATE_LIMIT_IP_COUNT = 5
RATE_LIMIT_IP_SECONDS = 60
JWT_ISSUER = "context8.com"
JWT_AUDIENCE = "context8-api"

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


# Pydantic models
class SendCodeRequest(BaseModel):
    email: EmailStr


class VerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str


class UserResponse(BaseModel):
    id: str
    username: str | None = None
    email: str
    emailVerified: bool
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


# Helper functions
def generate_code() -> str:
    """Generate a 6-digit verification code."""
    return f"{secrets.randbelow(1000000):06d}"


def hash_code(code: str, salt: str) -> str:
    """Hash verification code with salt using SHA256."""
    return hashlib.sha256(f"{code}{salt}".encode()).hexdigest()


def generate_salt() -> str:
    """Generate a random 32-character salt."""
    return secrets.token_hex(16)


def sign_session_token(user_id: str | uuid.UUID, email: str, is_admin: bool = False) -> str:
    """Sign a JWT session token with 7-day expiry."""
    exp = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
    sub = str(user_id)
    payload = {
        "sub": sub,
        "email": email,
        "exp": exp,
        "iss": JWT_ISSUER,
        "aud": JWT_AUDIENCE,
        "is_admin": bool(is_admin),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return pwd_context.verify(password, password_hash)
    except Exception:
        return False


async def send_verification_email(email: str, code: str):
    """Send verification code via Resend API."""
    if not RESEND_API_KEY:
        raise HTTPException(
            status_code=500, detail="RESEND_API_KEY not configured"
        )

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {RESEND_API_KEY}"},
            json={
                "from": RESEND_FROM,
                "to": email,
                "subject": "Your Context8 Verification Code",
                "html": f"""
                    <p>Your verification code is: <strong>{code}</strong></p>
                    <p>This code will expire in {CODE_EXPIRY_MINUTES} minutes.</p>
                    <p>If you didn't request this code, please ignore this email.</p>
                """,
            },
            timeout=30,
        )
        resp.raise_for_status()


async def log_auth_event(
    db: AsyncSession,
    email: str,
    event_type: str,
    success: bool,
    ip_address: str = None,
    user_agent: str = None,
):
    """Log authentication event to audit log."""
    log_entry = AuthAuditLog(
        id=secrets.token_hex(16),
        email=email,
        event_type=event_type,
        ip_address=ip_address,
        user_agent=user_agent,
        success=success,
    )
    db.add(log_entry)
    await db.commit()


async def check_rate_limit_email(db: AsyncSession, email: str):
    """Check if email has exceeded rate limit (1 request per minute)."""
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=RATE_LIMIT_EMAIL_SECONDS)
    result = await db.execute(
        select(func.count())
        .select_from(VerificationCode)
        .where(
            and_(
                VerificationCode.email == email,
                VerificationCode.created_at >= cutoff,
            )
        )
    )
    count = result.scalar()
    if count > 0:
        raise HTTPException(
            status_code=429,
            detail=f"Rate limit exceeded. Please wait {RATE_LIMIT_EMAIL_SECONDS} seconds between requests.",
        )


async def check_rate_limit_ip(db: AsyncSession, ip_address: str):
    """Check if IP has exceeded rate limit (5 requests per minute)."""
    cutoff = datetime.now(timezone.utc) - timedelta(seconds=RATE_LIMIT_IP_SECONDS)
    result = await db.execute(
        select(func.count())
        .select_from(VerificationCode)
        .where(
            and_(
                VerificationCode.ip_address == ip_address,
                VerificationCode.created_at >= cutoff,
            )
        )
    )
    count = result.scalar()
    if count >= RATE_LIMIT_IP_COUNT:
        raise HTTPException(
            status_code=429,
            detail=f"Too many requests from this IP. Please try again later.",
        )


async def check_lockout(db: AsyncSession, email: str):
    """Check if email is locked out due to failed attempts."""
    # Query the latest verification code for this email, regardless of verified status
    result = await db.execute(
        select(VerificationCode)
        .where(VerificationCode.email == email)
        .order_by(VerificationCode.created_at.desc())
        .limit(1)
    )
    latest_code = result.scalar_one_or_none()

    if latest_code and latest_code.locked_until:
        if datetime.now(timezone.utc) < latest_code.locked_until:
            remaining_seconds = int(
                (latest_code.locked_until - datetime.now(timezone.utc)).total_seconds()
            )
            raise HTTPException(
                status_code=429,
                detail=f"Account locked due to too many failed attempts. Try again in {remaining_seconds} seconds.",
            )


async def send_code(
    request: SendCodeRequest,
    req: Request,
    db: AsyncSession = Depends(get_session),
):
    """Send verification code to email."""
    email = request.email.lower()
    ip_address = req.client.host if req.client else None

    if not EMAIL_VERIFICATION_ENABLED:
        session = await _issue_session(db, email, verified=True)
        await log_auth_event(
            db, email, "login_no_verification", True, ip_address, req.headers.get("user-agent")
        )
        return session

    # Rate limiting
    await check_rate_limit_email(db, email)
    if ip_address:
        await check_rate_limit_ip(db, ip_address)

    # Check lockout
    await check_lockout(db, email)

    # Generate code and salt
    code = generate_code()
    salt = generate_salt()
    code_hash = hash_code(code, salt)

    # Create verification code record
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=CODE_EXPIRY_MINUTES)
    verification = VerificationCode(
        id=secrets.token_hex(16),
        email=email,
        code_hash=code_hash,
        salt=salt,
        expires_at=expires_at,
        ip_address=ip_address,
    )
    db.add(verification)
    await db.commit()

    # Send email
    try:
        await send_verification_email(email, code)
        await log_auth_event(
            db, email, "code_sent", True, ip_address, req.headers.get("user-agent")
        )
        return {"status": "sent", "message": f"Verification code sent to {email}"}
    except Exception as e:
        await log_auth_event(
            db, email, "code_sent", False, ip_address, req.headers.get("user-agent")
        )
        raise HTTPException(
            status_code=500, detail=f"Failed to send verification email: {str(e)}"
        )


async def verify_code(
    request: VerifyCodeRequest,
    req: Request,
    db: AsyncSession = Depends(get_session),
) -> SessionResponse:
    """Verify code and return session token."""
    email = request.email.lower()
    code = request.code.strip()
    ip_address = req.client.host if req.client else None

    if not EMAIL_VERIFICATION_ENABLED:
        session = await _issue_session(db, email, verified=True)
        await log_auth_event(
            db, email, "verify_skipped", True, ip_address, req.headers.get("user-agent")
        )
        return session

    # Check lockout first
    await check_lockout(db, email)

    # Find the latest unused verification code for this email
    result = await db.execute(
        select(VerificationCode)
        .where(
            and_(
                VerificationCode.email == email,
                VerificationCode.verified == False,
            )
        )
        .order_by(VerificationCode.created_at.desc())
        .limit(1)
    )
    verification = result.scalar_one_or_none()

    if not verification:
        await log_auth_event(
            db, email, "verify_failed", False, ip_address, req.headers.get("user-agent")
        )
        raise HTTPException(
            status_code=401, detail="No verification code found or code already used"
        )

    # Check expiration
    if datetime.now(timezone.utc) > verification.expires_at:
        await log_auth_event(
            db, email, "verify_failed", False, ip_address, req.headers.get("user-agent")
        )
        raise HTTPException(status_code=401, detail="Verification code expired")

    # Verify code
    code_hash = hash_code(code, verification.salt)
    if code_hash != verification.code_hash:
        # Increment failed attempts
        verification.failed_attempts += 1

        # Lock account if too many failed attempts
        if verification.failed_attempts >= MAX_FAILED_ATTEMPTS:
            verification.locked_until = datetime.now(timezone.utc) + timedelta(
                minutes=LOCKOUT_MINUTES
            )
            await db.commit()
            await log_auth_event(
                db, email, "locked", False, ip_address, req.headers.get("user-agent")
            )
            raise HTTPException(
                status_code=429,
                detail=f"Too many failed attempts. Account locked for {LOCKOUT_MINUTES} minutes.",
            )

        await db.commit()
        await log_auth_event(
            db, email, "verify_failed", False, ip_address, req.headers.get("user-agent")
        )
        raise HTTPException(
            status_code=401,
            detail=f"Invalid verification code. {MAX_FAILED_ATTEMPTS - verification.failed_attempts} attempts remaining.",
        )

    # Mark verification as verified
    verification.verified = True
    await db.commit()

    session = await _issue_session(db, email, verified=True)

    await log_auth_event(
        db, email, "verify_success", True, ip_address, req.headers.get("user-agent")
    )

    return session


async def _issue_session(
    db: AsyncSession,
    email: str,
    verified: bool,
) -> SessionResponse:
    user_result = await db.execute(select(User).where(User.email == email))
    user = user_result.scalar_one_or_none()

    if not user:
        user = User(
            id=uuid.uuid4(),
            username=email,
            email=email,
            password="",
            email_verified=verified,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        updated = False
        if verified and not user.email_verified:
            user.email_verified = True
            updated = True
        if not user.username:
            user.username = email
            updated = True
        if user.password is None:
            user.password = ""
            updated = True
        if updated:
            await db.commit()

    session_token = sign_session_token(user.id, user.email, bool(user.is_admin))
    return SessionResponse(
        token=session_token,
        user=UserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            emailVerified=user.email_verified,
            isAdmin=bool(user.is_admin),
        ),
    )


async def ensure_user(
    db: AsyncSession,
    user_id: str,
) -> User:
    try:
        user_uuid = uuid.UUID(str(user_id))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    if EMAIL_VERIFICATION_ENABLED and not user.email_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email not verified. Please verify your email to access this resource.",
        )
    return user


async def admin_exists(db: AsyncSession) -> bool:
    result = await db.execute(select(func.count()).select_from(User).where(User.is_admin == True))
    return (result.scalar() or 0) > 0


async def setup_admin(
    request: AdminSetupRequest,
    db: AsyncSession,
) -> SessionResponse:
    if await admin_exists(db):
        raise HTTPException(status_code=409, detail="Admin already exists")

    username = request.username.strip()
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    if len(request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    email = (request.email or username).strip()
    password_hash = hash_password(request.password)

    existing = await db.execute(
        select(User).where(or_(User.username == username, User.email == email))
    )
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
            emailVerified=user.email_verified,
            isAdmin=True,
        ),
    )


async def login(
    request: LoginRequest,
    db: AsyncSession,
) -> SessionResponse:
    identifier = request.identifier.strip()
    if not identifier:
        raise HTTPException(status_code=400, detail="Identifier is required")

    result = await db.execute(
        select(User).where(or_(User.username == identifier, User.email == identifier))
    )
    user = result.scalar_one_or_none()
    if not user or not user.password or not verify_password(request.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    session_token = sign_session_token(user.id, user.email, bool(user.is_admin))
    return SessionResponse(
        token=session_token,
        user=UserResponse(
            id=str(user.id),
            username=user.username,
            email=user.email,
            emailVerified=user.email_verified,
            isAdmin=bool(user.is_admin),
        ),
    )


def verify_session_token(authorization: str | None = Header(default=None)):
    """Verify JWT session token."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing bearer token"
        )

    token = authorization.split(" ", 1)[1]

    try:
        payload = jwt.decode(
            token,
            JWT_SECRET,
            algorithms=[JWT_ALG],
            audience=JWT_AUDIENCE,
            issuer=JWT_ISSUER,
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=f"Invalid token: {str(e)}"
        )


def get_current_user(payload=Depends(verify_session_token)):
    """Get current user from JWT token."""
    user_id = payload.get("sub")
    email = payload.get("email")
    is_admin = payload.get("is_admin")

    if not user_id or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )

    return {"id": user_id, "email": email, "is_admin": bool(is_admin)}


def get_user_sub(payload=Depends(verify_session_token)) -> str:
    """Extract user ID (sub) from JWT token.

    Dependency injection function for extracting user ID from JWT token.
    Suitable for scenarios that only need user_id (e.g., API Key management).

    Note: This function does not check email_verified, additional verification
    is required in the business logic.
    """
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
        )
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
