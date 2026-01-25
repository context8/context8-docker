#!/usr/bin/env python3
"""
Local cleanup task for Context8 CLI.

This is the local deployment alternative to the scheduled cleanup in modal_app.py.
It cleans up expired verification codes older than 24 hours.

Usage:
    # Run once
    python local_cleanup.py

    # Run continuously with a schedule (every 6 hours)
    python local_cleanup.py --schedule

For production, you can set up a cron job:
    0 */6 * * * cd /path/to/context8-CLI && python local_cleanup.py
"""
import argparse
import asyncio
import sys
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

# Load environment variables from .env file
load_dotenv()


async def cleanup_expired_codes():
    """Cleanup expired verification codes older than 24 hours."""
    from app.database import engine
    from app.models import VerificationCode

    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    async with AsyncSession(engine) as session:
        result = await session.execute(
            delete(VerificationCode).where(
                VerificationCode.created_at < cutoff
            )
        )
        await session.commit()
        deleted_count = result.rowcount

    print(f"[{datetime.now(timezone.utc).isoformat()}] Cleanup completed: deleted {deleted_count} expired verification codes")
    return {"deleted": deleted_count, "cutoff": cutoff.isoformat()}


async def run_scheduled(interval_hours: int = 6):
    """Run cleanup task on a schedule."""
    print(f"Starting scheduled cleanup task (every {interval_hours} hours)")
    print("Press Ctrl+C to stop")

    while True:
        try:
            await cleanup_expired_codes()
        except Exception as e:
            print(f"Error during cleanup: {e}", file=sys.stderr)

        # Sleep for the specified interval
        await asyncio.sleep(interval_hours * 3600)


def main():
    parser = argparse.ArgumentParser(description="Run Context8 cleanup tasks")
    parser.add_argument(
        "--schedule",
        action="store_true",
        help="Run continuously on a schedule (every 6 hours)",
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=6,
        help="Interval in hours between cleanups when using --schedule (default: 6)",
    )
    args = parser.parse_args()

    if args.schedule:
        try:
            asyncio.run(run_scheduled(args.interval))
        except KeyboardInterrupt:
            print("\nShutting down cleanup task...")
            return 0
    else:
        # Run once
        result = asyncio.run(cleanup_expired_codes())
        print(f"Result: {result}")
        return 0


if __name__ == "__main__":
    exit(main())
