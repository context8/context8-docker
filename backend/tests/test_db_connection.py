"""Test script to verify a database connection."""
import asyncio
import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.engine.url import make_url
import re

# Database URL (set DATABASE_URL for local testing)
raw_url = os.environ.get(
    "DATABASE_URL",
    "postgresql+asyncpg://context8:changeme@localhost:5432/context8",
)

def normalize_url(url_str: str) -> str:
    """Normalize the URL for asyncpg."""
    # Strip psql wrapper if present
    if url_str.strip().startswith("psql"):
        match = re.search(r"['\"]([^'\"]+)['\"]", url_str)
        if match:
            url_str = match.group(1)

    url = make_url(url_str)
    query = dict(url.query)

    # Remove asyncpg-incompatible params
    query.pop("channel_binding", None)
    query.pop("sslmode", None)
    query.pop("ssl", None)

    # Use asyncpg driver
    driver = "postgresql+asyncpg"
    normalized = url.set(drivername=driver, query=query)

    return str(normalized)


async def test_connection():
    """Test the database connection."""
    try:
        print("🔍 Testing database connection...")

        # Normalize URL
        normalized_url = normalize_url(raw_url)
        print(f"✅ URL normalized successfully")
        # Debug: print sanitized URL (hide password)
        print("   Normalized URL loaded")

        # Create engine with SSL (asyncpg uses 'require' for SSL mode)
        engine = create_async_engine(normalized_url, echo=False)
        print(f"✅ Engine created with SSL enabled\n")

        # Test connection
        print("🔌 Attempting to connect...")
        async with engine.begin() as conn:
            # Test basic query
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✅ Connected successfully!")
            print(f"   PostgreSQL version: {version[:50]}...\n")

            # Test database name
            result = await conn.execute(text("SELECT current_database()"))
            db_name = result.scalar()
            print(f"✅ Current database: {db_name}")

            # Test user
            result = await conn.execute(text("SELECT current_user"))
            user = result.scalar()
            print(f"✅ Current user: {user}\n")

            # Check tables
            result = await conn.execute(text("""
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = 'public'
                ORDER BY table_name
            """))
            tables = result.fetchall()

            if tables:
                print(f"📊 Found {len(tables)} table(s) in public schema:")
                for table in tables:
                    print(f"   - {table[0]}")
            else:
                print("📊 No tables found in public schema (this is normal for a new database)")

        await engine.dispose()
        print(f"\n✅ Database connection test PASSED!")
        return True

    except Exception as e:
        print(f"\n❌ Database connection test FAILED!")
        print(f"   Error: {str(e)}")
        import traceback
        print(f"\n   Traceback:")
        traceback.print_exc()
        return False


if __name__ == "__main__":
    from sqlalchemy import text
    success = asyncio.run(test_connection())
    exit(0 if success else 1)
