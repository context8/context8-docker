import argparse
import asyncio
from typing import Iterable, List

import httpx

from app.database import AsyncSessionLocal
from app.es import ES_INDEX, ES_URL
from app.models import Solution
from app.worker import enqueue_es_delete_task, enqueue_es_sync_task
from sqlalchemy import select


async def _iter_solution_ids(batch_size: int) -> Iterable[List[str]]:
    last_id = None
    async with AsyncSessionLocal() as session:
        while True:
            stmt = select(Solution.id).order_by(Solution.id).limit(batch_size)
            if last_id:
                stmt = stmt.where(Solution.id > last_id)
            res = await session.execute(stmt)
            ids = [row[0] for row in res.fetchall()]
            if not ids:
                break
            last_id = ids[-1]
            yield ids


async def _fetch_es_docs(ids: List[str]) -> dict[str, bool]:
    if not ES_URL:
        raise RuntimeError("ES_URL is not set")
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(f"{ES_URL}/{ES_INDEX}/_mget", json={"ids": ids})
        resp.raise_for_status()
        data = resp.json()
    found = {}
    for doc in data.get("docs", []):
        found[doc.get("_id")] = bool(doc.get("found"))
    return found


async def _iter_es_ids(batch_size: int) -> Iterable[List[str]]:
    if not ES_URL:
        raise RuntimeError("ES_URL is not set")
    search_after = None
    async with httpx.AsyncClient(timeout=10) as client:
        while True:
            body = {
                "size": batch_size,
                "sort": ["_id"],
                "_source": False,
                "query": {"match_all": {}},
            }
            if search_after:
                body["search_after"] = search_after
            resp = await client.post(f"{ES_URL}/{ES_INDEX}/_search", json=body)
            resp.raise_for_status()
            data = resp.json()
            hits = data.get("hits", {}).get("hits", [])
            if not hits:
                break
            ids = [hit.get("_id") for hit in hits if hit.get("_id")]
            if not ids:
                break
            search_after = hits[-1].get("sort")
            yield ids


async def _resolve_existing_ids(ids: List[str]) -> set[str]:
    if not ids:
        return set()
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Solution.id).where(Solution.id.in_(ids)))
        return {row[0] for row in res.fetchall()}


async def reconcile_es(
    batch_size: int,
    fix_missing: bool,
    delete_orphans: bool,
    dry_run: bool,
) -> None:
    missing_total = 0
    orphan_total = 0

    async for ids in _iter_solution_ids(batch_size):
        found_map = await _fetch_es_docs(ids)
        missing = [sol_id for sol_id in ids if not found_map.get(sol_id)]
        if missing:
            missing_total += len(missing)
            if fix_missing and not dry_run:
                for sol_id in missing:
                    enqueue_es_sync_task(sol_id)

    if delete_orphans:
        async for ids in _iter_es_ids(batch_size):
            existing = await _resolve_existing_ids(ids)
            orphans = [sol_id for sol_id in ids if sol_id not in existing]
            if orphans:
                orphan_total += len(orphans)
                if not dry_run:
                    for sol_id in orphans:
                        enqueue_es_delete_task(sol_id)

    print(
        f"reconcile_es done missing={missing_total} orphans={orphan_total} "
        f"fix_missing={fix_missing} delete_orphans={delete_orphans} dry_run={dry_run}"
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="Reconcile Elasticsearch with database solutions.")
    parser.add_argument("--batch-size", type=int, default=200)
    parser.add_argument("--fix-missing", action="store_true")
    parser.add_argument("--delete-orphans", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    asyncio.run(
        reconcile_es(
            batch_size=args.batch_size,
            fix_missing=args.fix_missing,
            delete_orphans=args.delete_orphans,
            dry_run=args.dry_run,
        )
    )


if __name__ == "__main__":
    main()
