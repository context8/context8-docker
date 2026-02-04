"""Direct asyncpg test without SQLAlchemy."""
import asyncio
import asyncpg
import os

async def test_direct_connection():
    """Test asyncpg connection directly."""
    try:
        print("🔍 Testing direct asyncpg connection...")
        host = os.environ.get("DB_HOST", "localhost")
        port = int(os.environ.get("DB_PORT", "5432"))
        user = os.environ.get("DB_USER", "context8")
        password = os.environ.get("DB_PASSWORD", "changeme")
        database = os.environ.get("DB_NAME", "context8")
        ssl_mode = os.environ.get("DB_SSL", "disable")

        print(f"   Host: {host}")
        print(f"   Database: {database}")
        print(f"   User: {user}\n")

        # Connect using asyncpg directly
        print("🔌 Attempting to connect...")
        conn = await asyncpg.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            database=database,
            ssl=ssl_mode if ssl_mode != "disable" else None,
        )

        print(f"✅ Connected successfully!\n")

        # Test query
        version = await conn.fetchval('SELECT version()')
        print(f"✅ PostgreSQL version: {version[:80]}...\n")

        # Get current database
        db_name = await conn.fetchval('SELECT current_database()')
        print(f"✅ Current database: {db_name}")

        # Get current user
        user = await conn.fetchval('SELECT current_user')
        print(f"✅ Current user: {user}\n")

        # Check tables
        tables = await conn.fetch("""
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            ORDER BY table_name
        """)

        if tables:
            print(f"📊 Found {len(tables)} table(s) in public schema:")
            for table in tables:
                print(f"   - {table['table_name']}")
        else:
            print("📊 No tables found in public schema")

        await conn.close()
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
    success = asyncio.run(test_direct_connection())
    exit(0 if success else 1)
