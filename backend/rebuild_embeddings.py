import argparse
import asyncio

from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.embeddings import embed_text
from app.models import Solution
from app.schemas import SolutionCreate
from app.vector import add_vector


async def rebuild_embeddings(batch_size: int, only_missing: bool, dry_run: bool) -> None:
    total = 0
    updated = 0
    last_id = None

    async with AsyncSessionLocal() as db:
        while True:
            stmt = select(Solution).order_by(Solution.id).limit(batch_size)
            if last_id is not None:
                stmt = stmt.where(Solution.id > last_id)
            if only_missing:
                stmt = stmt.where(Solution.embedding.is_(None))

            res = await db.execute(stmt)
            rows = res.scalars().all()
            if not rows:
                break

            for sol in rows:
                payload = SolutionCreate(
                    title=sol.title,
                    errorMessage=sol.error_message,
                    errorType=sol.error_type,
                    context=sol.context,
                    rootCause=sol.root_cause,
                    solution=sol.solution,
                    codeChanges=sol.code_changes,
                    tags=sol.tags,
                    visibility=sol.visibility,
                    projectPath=sol.project_path,
                    environment=sol.environment,
                )
                vector = await embed_text(payload)
                if not dry_run:
                    await add_vector(db, sol.id, vector)
                total += 1
                updated += 0 if dry_run else 1
                last_id = sol.id

            if not dry_run:
                await db.commit()

    print(f"[rebuild] scanned={total} updated={updated} dry_run={dry_run}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Rebuild solution embeddings in Postgres.")
    parser.add_argument("--batch-size", type=int, default=200)
    parser.add_argument("--only-missing", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    asyncio.run(rebuild_embeddings(args.batch_size, args.only_missing, args.dry_run))


if __name__ == "__main__":
    main()
