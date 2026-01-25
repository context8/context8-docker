import asyncio
import json
import os
from typing import Any, Iterable

import httpx
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.models import Solution, EMBEDDING_DIM


ES_URL = os.environ.get("ES_URL") or os.environ.get("ELASTICSEARCH_URL") or "http://localhost:9200"
ES_INDEX = os.environ.get("ES_INDEX", "solutions")
BATCH_SIZE = int(os.environ.get("ES_REINDEX_BATCH", "200"))


def _build_mapping() -> dict[str, Any]:
    return {
        "mappings": {
            "properties": {
                "id": {"type": "keyword"},
                "user_id": {"type": "keyword"},
                "api_key_id": {"type": "keyword"},
                "title": {"type": "text"},
                "error_message": {"type": "text"},
                "error_type": {"type": "keyword"},
                "context": {"type": "text"},
                "root_cause": {"type": "text"},
                "solution": {"type": "text"},
                "code_changes": {"type": "object", "enabled": False},
                "tags": {"type": "keyword"},
                "conversation_language": {"type": "keyword"},
                "programming_language": {"type": "keyword"},
                "project_path": {"type": "keyword"},
                "environment": {"type": "object", "enabled": False},
                "visibility": {"type": "keyword"},
                "created_at": {"type": "date"},
                "embedding": {
                    "type": "dense_vector",
                    "dims": EMBEDDING_DIM,
                    "index": True,
                    "similarity": "l2_norm",
                },
            }
        }
    }


def _serialize_solution(sol: Solution) -> dict[str, Any]:
    doc = {
        "id": sol.id,
        "user_id": str(sol.user_id) if sol.user_id else None,
        "api_key_id": sol.api_key_id,
        "title": sol.title,
        "error_message": sol.error_message,
        "error_type": sol.error_type,
        "context": sol.context,
        "root_cause": sol.root_cause,
        "solution": sol.solution,
        "code_changes": sol.code_changes,
        "tags": sol.tags or [],
        "conversation_language": sol.conversation_language,
        "programming_language": sol.programming_language,
        "project_path": sol.project_path,
        "environment": sol.environment,
        "visibility": sol.visibility,
        "created_at": sol.created_at.isoformat() if sol.created_at else None,
    }
    if sol.embedding is not None:
        doc["embedding"] = [float(x) for x in sol.embedding]
    return doc


def _bulk_payload(docs: Iterable[dict[str, Any]]) -> str:
    lines = []
    for doc in docs:
        doc_id = doc["id"]
        lines.append(json.dumps({"index": {"_index": ES_INDEX, "_id": doc_id}}))
        lines.append(json.dumps(doc))
    return "\n".join(lines) + "\n"


async def _recreate_index(client: httpx.AsyncClient) -> None:
    await client.delete(f"{ES_URL}/{ES_INDEX}")
    resp = await client.put(f"{ES_URL}/{ES_INDEX}", json=_build_mapping())
    resp.raise_for_status()


async def _reindex() -> None:
    async with httpx.AsyncClient(timeout=30) as client:
        await _recreate_index(client)

        total = 0
        async with AsyncSessionLocal() as db:
            offset = 0
            while True:
                result = await db.execute(
                    select(Solution).order_by(Solution.created_at.desc()).limit(BATCH_SIZE).offset(offset)
                )
                rows = result.scalars().all()
                if not rows:
                    break

                docs = [_serialize_solution(row) for row in rows]
                payload = _bulk_payload(docs)
                resp = await client.post(
                    f"{ES_URL}/_bulk",
                    content=payload,
                    headers={"Content-Type": "application/x-ndjson"},
                )
                resp.raise_for_status()
                resp_json = resp.json()
                if resp_json.get("errors"):
                    failures = []
                    for item in resp_json.get("items", []):
                        action = item.get("index", {})
                        if "error" in action:
                            failures.append(
                                {
                                    "id": action.get("_id"),
                                    "status": action.get("status"),
                                    "error": action.get("error"),
                                }
                            )
                        if len(failures) >= 3:
                            break
                    print("[reindex] bulk errors sample:", json.dumps(failures, indent=2))
                    raise RuntimeError("Bulk indexing reported errors")

                total += len(rows)
                offset += len(rows)
                print(f"[reindex] indexed={total}")

    print(f"[reindex] done total={total}")


if __name__ == "__main__":
    asyncio.run(_reindex())
