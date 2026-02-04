"""Test using the actual app/database.py configuration."""
import asyncio
import os

# Set default database URL for local testing if not provided
os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://context8:changeme@localhost:5432/context8",
)

# Import the database module (this will create the engine)
from app.database import engine
from sqlalchemy import text


async def test_database():
    """Test the database connection using app/database.py configuration."""
    try:
        print("🔍 Testing database connection using app/database.py...")
        print(f"✅ Engine loaded from app/database.py\n")

        # Test connection
        print("🔌 Attempting to connect...")
        async with engine.begin() as conn:
            # Test basic query
            result = await conn.execute(text("SELECT version()"))
            version = result.scalar()
            print(f"✅ Connected successfully!")
            print(f"   PostgreSQL version: {version[:80]}...\n")

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
        print(f"✅ The app/database.py configuration works with the current database!")
        return True

    except Exception as e:
        print(f"\n❌ Database connection test FAILED!")
        print(f"   Error: {str(e)}")
        import traceback
        print(f"\n   Traceback:")
        traceback.print_exc()
        return False


if __name__ == "__main__":
    success = asyncio.run(test_database())
    exit(0 if success else 1)
