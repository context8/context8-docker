import asyncio
import json
import os
from typing import Any, Iterable

import httpx
from sqlalchemy import select

from app.database import AsyncSessionLocal
from app.embeddings import embed_text
from app.es import ES_INDEX, ES_URL, build_es_mapping
from app.models import Solution


BATCH_SIZE = int(os.environ.get("ES_REINDEX_BATCH", "200"))
INCLUDE_EMBEDDING = float(os.environ.get("ES_KNN_WEIGHT", "0")) > 0


async def _serialize_solution(sol: Solution, include_embedding: bool) -> dict[str, Any]:
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
        "vibecoding_software": sol.vibecoding_software,
        "project_path": sol.project_path,
        "environment": sol.environment,
        "visibility": sol.visibility,
        "created_at": sol.created_at.isoformat() if sol.created_at else None,
        "upvotes": int(sol.upvotes or 0),
        "downvotes": int(sol.downvotes or 0),
    }
    if include_embedding:
        payload = {
            "title": sol.title,
            "errorMessage": sol.error_message,
            "errorType": sol.error_type,
            "context": sol.context,
            "rootCause": sol.root_cause,
            "solution": sol.solution,
            "tags": sol.tags or [],
            "environment": sol.environment,
        }
        doc["embedding"] = await embed_text(payload)
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
    resp = await client.put(f"{ES_URL}/{ES_INDEX}", json=build_es_mapping(INCLUDE_EMBEDDING))
    resp.raise_for_status()


async def _reindex() -> None:
    if not ES_URL:
        raise RuntimeError("ES_URL is not set")
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
                docs = [await _serialize_solution(row, INCLUDE_EMBEDDING) for row in rows]
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
