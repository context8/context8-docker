from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base
from sqlalchemy.engine.url import make_url, URL
from sqlalchemy.pool import NullPool
import os
import re

raw_url = os.environ.get("DATABASE_URL")
if not raw_url:
    raise RuntimeError("DATABASE_URL is not set")

# Strip any shell command wrappers (e.g., "psql 'url'" -> "url")
# This handles cases where the secret contains the full psql command
if raw_url.strip().startswith("psql"):
    match = re.search(r"['\"]([^'\"]+)['\"]", raw_url)
    if match:
        raw_url = match.group(1)
        print("[DB] Stripped 'psql' wrapper from DATABASE_URL")
    else:
        # If no quotes found, try to extract URL pattern
        url_match = re.search(r"postgresql://[^\s]+", raw_url)
        if url_match:
            raw_url = url_match.group(0)
            print("[DB] Extracted PostgreSQL URL from command string")

def _normalize_url(url_str: str) -> tuple[URL, bool]:
    url = make_url(url_str)
    query = dict(url.query)
    ssl_disabled = False

    sslmode = query.get("sslmode") or query.get("ssl")
    if sslmode is not None:
        ssl_value = str(sslmode).lower()
        if ssl_value in ("disable", "false", "0", "no"):
            ssl_disabled = True

    # asyncpg does not accept sslmode/channel_binding as query params
    # Remove them completely - we'll handle SSL via connect_args
    removed_params = []
    if query.pop("channel_binding", None):
        removed_params.append("channel_binding")
    if query.pop("sslmode", None):
        removed_params.append("sslmode")

    # Remove ssl query param if it exists (asyncpg doesn't support it as URL param)
    if query.pop("ssl", None):
        removed_params.append("ssl")

    driver = url.drivername
    if driver in ("postgresql", "postgres", "postgresql+psycopg2"):
        driver = "postgresql+asyncpg"

    normalized = url.set(drivername=driver, query=query)

    # Debug logging (sanitized - no credentials)
    if removed_params:
        print(f"[DB] Removed incompatible params: {', '.join(removed_params)}")
    print(f"[DB] Normalized URL - driver: {normalized.drivername}, host: {normalized.host}")

    return normalized, ssl_disabled

DATABASE_URL, SSL_DISABLED_IN_URL = _normalize_url(raw_url)
USE_NULL_POOL = os.environ.get("DATABASE_NULL_POOL", "").lower() in ("1", "true", "yes")
if not USE_NULL_POOL and DATABASE_URL.host and "pooler" in DATABASE_URL.host:
    USE_NULL_POOL = True
    print("[DB] Detected pooler host; using NullPool to avoid stale connections")

def _parse_ssl_env(value: str | None) -> bool | None:
    if not value:
        return None
    normalized = value.lower()
    if normalized in ("1", "true", "yes", "require", "verify", "verify-full"):
        return True
    if normalized in ("0", "false", "no", "disable"):
        return False
    return None


ssl_env = _parse_ssl_env(os.environ.get("DATABASE_SSL") or os.environ.get("DB_SSL"))
ssl_enabled = ssl_env if ssl_env is not None else not SSL_DISABLED_IN_URL

# For asyncpg, SSL must be passed via connect_args, not as URL parameter
# Use ssl=True for secure connections when required by cloud providers
# Add connection pool settings for managed database connections
connect_args = {
    "server_settings": {
        "application_name": "context8_api"
    }
}
if ssl_enabled:
    connect_args["ssl"] = True
    print("[DB] SSL enabled via connect_args")
else:
    print("[DB] SSL disabled via connect_args")

engine_kwargs = {
    "future": True,
    "echo": False,
    "connect_args": connect_args,
}

if USE_NULL_POOL:
    engine_kwargs["poolclass"] = NullPool
else:
    engine_kwargs.update(
        {
            "pool_pre_ping": True,  # Check connection health before using
            "pool_size": 5,  # Number of connections to keep in pool
            "max_overflow": 10,  # Max additional connections
            "pool_recycle": 3600,  # Recycle connections after 1 hour
        }
    )

engine = create_async_engine(DATABASE_URL, **engine_kwargs)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)
Base = declarative_base()


async def get_session() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session
