from typing import List

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from .database import engine
from .visibility import VISIBILITY_PRIVATE, VISIBILITY_TEAM

# For pgvector; assume extension is installed and embedding column is Vector


async def init_vector_store():
    """Create ANN index if pgvector is available; do not block startup on failure."""
    try:
        async with engine.begin() as conn:
            await conn.execute(
                text(
                    "CREATE INDEX IF NOT EXISTS solutions_embedding_idx "
                    "ON solutions USING ivfflat (embedding vector_l2_ops) WITH (lists = 100)"
                )
            )
    except Exception as exc:
        # Keep the API up even if index creation fails (e.g., lacking extension rights)
        print(f"[vector] Skipped index init: {exc}")


async def add_vector(db: AsyncSession, doc_id: str, vector: list[float]):
    # asyncpg expects vector literal like '[1,2,3]'; convert list to string
    vec_literal = "[" + ",".join(f"{float(v):.6f}" for v in vector) + "]"
    await db.execute(
        text("UPDATE solutions SET embedding = (:vec)::vector WHERE id = :id"),
        {"vec": vec_literal, "id": doc_id},
    )
    await db.commit()


async def search_vector(
    db: AsyncSession,
    query_vec: list[float],
    api_key_ids: list[str],
    allow_team: bool,
    limit: int = 25,
    visibility: str | None = None,
):
    vec_literal = "[" + ",".join(f"{float(v):.6f}" for v in query_vec) + "]"
    params = {"vec": vec_literal, "limit": limit}
    access_filter = ""
    if visibility == VISIBILITY_TEAM:
        if not allow_team:
            return []
        access_filter = "AND solutions.visibility = 'team'"
    elif visibility == VISIBILITY_PRIVATE:
        if not api_key_ids:
            return []
        access_filter = "AND solutions.visibility = 'private' AND solutions.api_key_id = ANY(:api_key_ids)"
        params["api_key_ids"] = api_key_ids
    else:
        if api_key_ids and allow_team:
            access_filter = (
                "AND (solutions.visibility = 'team' "
                "OR (solutions.visibility = 'private' AND solutions.api_key_id = ANY(:api_key_ids)))"
            )
            params["api_key_ids"] = api_key_ids
        elif api_key_ids:
            access_filter = "AND solutions.visibility = 'private' AND solutions.api_key_id = ANY(:api_key_ids)"
            params["api_key_ids"] = api_key_ids
        elif allow_team:
            access_filter = "AND solutions.visibility = 'team'"
        else:
            return []
    res = await db.execute(
        text(
            "SELECT id, title, error_type, tags, created_at, error_message, solution, visibility, api_key_id, vibecoding_software, upvotes, downvotes, "
            "substring(error_message,1,80) as preview_msg, substring(context,1,50) as preview_ctx "
            "FROM solutions "
            f"WHERE embedding IS NOT NULL {access_filter} "
            "ORDER BY embedding <=> (:vec)::vector "
            "LIMIT :limit"
        ),
        params,
    )
    rows = res.fetchall()
    results = []
    for r in rows:
        preview = f"{r.preview_msg}{'...' if len(r.preview_msg) >= 80 else ''} | {r.preview_ctx}"
        results.append(
            {
                "id": r.id,
                "title": r.title,
                "errorType": r.error_type,
                "tags": r.tags or [],
                "createdAt": r.created_at,
                "preview": preview,
                "errorMessage": r.error_message,
                "solution": r.solution,
                "visibility": r.visibility,
                "apiKeyId": r.api_key_id,
                "vibecodingSoftware": r.vibecoding_software,
                "upvotes": r.upvotes,
                "downvotes": r.downvotes,
                "voteScore": int((r.upvotes or 0) - (r.downvotes or 0)),
            }
        )
    return results
