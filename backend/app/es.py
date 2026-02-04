import os
from typing import Any, Optional

import httpx

from .visibility import VISIBILITY_PRIVATE, VISIBILITY_TEAM


ES_URL = os.environ.get("ES_URL") or os.environ.get("ELASTICSEARCH_URL")
ES_INDEX = os.environ.get("ES_INDEX", "solutions")
ES_TIMEOUT = float(os.environ.get("ES_TIMEOUT", "5"))
ES_USERNAME = os.environ.get("ES_USERNAME")
ES_PASSWORD = os.environ.get("ES_PASSWORD")
ES_KNN_WEIGHT = float(os.environ.get("ES_KNN_WEIGHT", "0"))
ES_BM25_WEIGHT = float(os.environ.get("ES_BM25_WEIGHT", "1"))

def _require_es_url() -> str:
    if not ES_URL:
        raise RuntimeError("Elasticsearch is not configured (ES_URL missing)")
    return ES_URL


def _auth() -> Optional[tuple[str, str]]:
    if ES_USERNAME and ES_PASSWORD:
        return (ES_USERNAME, ES_PASSWORD)
    return None


def _build_access_filter(
    api_key_ids: list[str],
    allow_team: bool,
    allow_admin: bool,
    visibility: Optional[str] = None,
) -> dict:
    if allow_admin:
        if visibility == VISIBILITY_TEAM:
            return {"term": {"visibility": VISIBILITY_TEAM}}
        if visibility == VISIBILITY_PRIVATE:
            return {"term": {"visibility": VISIBILITY_PRIVATE}}
        return {"match_all": {}}

    if visibility == VISIBILITY_TEAM:
        return {"term": {"visibility": VISIBILITY_TEAM}}
    if visibility == VISIBILITY_PRIVATE:
        return {
            "bool": {
                "must": [
                    {"term": {"visibility": VISIBILITY_PRIVATE}},
                    {"terms": {"api_key_id": api_key_ids}},
                ]
            }
        }
    if allow_team and api_key_ids:
        return {
            "bool": {
                "should": [
                    {"term": {"visibility": VISIBILITY_TEAM}},
                    {
                        "bool": {
                            "must": [
                                {"term": {"visibility": VISIBILITY_PRIVATE}},
                                {"terms": {"api_key_id": api_key_ids}},
                            ]
                        }
                    },
                ],
                "minimum_should_match": 1,
            }
        }
    if allow_team and not api_key_ids:
        return {"term": {"visibility": VISIBILITY_TEAM}}
    return {
        "bool": {
            "must": [
                {"term": {"visibility": VISIBILITY_PRIVATE}},
                {"terms": {"api_key_id": api_key_ids}},
            ]
        }
    }


async def search_solutions_es(
    query: str,
    api_key_ids: list[str],
    allow_team: bool,
    allow_admin: bool,
    limit: int,
    offset: int,
    vector: Optional[list[float]] = None,
    visibility: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    if not ES_URL:
        return None

    access_filter = _build_access_filter(api_key_ids, allow_team, allow_admin, visibility)
    query_body: dict[str, Any]
    if ES_BM25_WEIGHT > 0:
        query_body = {
            "multi_match": {
                "query": query,
                "fields": [
                    "title^3",
                    "error_message^2",
                    "context",
                    "root_cause",
                    "solution",
                ],
                "type": "best_fields",
                "boost": ES_BM25_WEIGHT,
            }
        }
    else:
        query_body = {"match_all": {}}

    body: dict[str, Any] = {
        "size": limit,
        "from": offset,
        "_source": [
            "id",
            "title",
            "error_type",
            "tags",
            "created_at",
            "error_message",
            "context",
            "solution",
            "visibility",
            "api_key_id",
            "vibecoding_software",
            "upvotes",
            "downvotes",
        ],
        "query": {
            "bool": {
                "filter": [access_filter],
                "must": [query_body],
            }
        },
    }

    if vector and ES_KNN_WEIGHT > 0:
        body["knn"] = {
            "field": "embedding",
            "query_vector": vector,
            "k": limit,
            "num_candidates": max(limit * 4, 100),
            "filter": access_filter,
            "boost": ES_KNN_WEIGHT,
        }

    async with httpx.AsyncClient(timeout=ES_TIMEOUT, auth=_auth()) as client:
        resp = await client.post(f"{ES_URL}/{ES_INDEX}/_search", json=body)
        resp.raise_for_status()
        return resp.json()


async def fetch_solution_es(
    solution_id: str,
    api_key_ids: list[str],
    allow_team: bool,
    allow_admin: bool,
    visibility: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    if not ES_URL:
        return None

    access_filter = _build_access_filter(api_key_ids, allow_team, allow_admin, visibility)
    body: dict[str, Any] = {
        "size": 1,
        "_source": [
            "id",
            "title",
            "error_message",
            "error_type",
            "context",
            "root_cause",
            "solution",
            "code_changes",
            "tags",
            "conversation_language",
            "programming_language",
            "vibecoding_software",
            "project_path",
            "environment",
            "visibility",
            "api_key_id",
            "upvotes",
            "downvotes",
            "created_at",
        ],
        "query": {
            "bool": {
                "filter": [
                    access_filter,
                    {"term": {"id": solution_id}},
                ]
            }
        },
    }

    async with httpx.AsyncClient(timeout=ES_TIMEOUT, auth=_auth()) as client:
        resp = await client.post(f"{ES_URL}/{ES_INDEX}/_search", json=body)
        resp.raise_for_status()
        data = resp.json()
        hits = data.get("hits", {}).get("hits", [])
        if not hits:
            return None
        return hits[0].get("_source") or None


async def index_solution_es(doc_id: str, payload: dict[str, Any]) -> None:
    es_url = _require_es_url()
    async with httpx.AsyncClient(timeout=ES_TIMEOUT, auth=_auth()) as client:
        resp = await client.put(f"{es_url}/{ES_INDEX}/_doc/{doc_id}", json=payload)
        resp.raise_for_status()


async def update_solution_es(doc_id: str, payload: dict[str, Any]) -> None:
    es_url = _require_es_url()
    body = {"doc": payload, "doc_as_upsert": True}
    async with httpx.AsyncClient(timeout=ES_TIMEOUT, auth=_auth()) as client:
        resp = await client.post(f"{es_url}/{ES_INDEX}/_update/{doc_id}", json=body)
        resp.raise_for_status()


async def delete_solution_es(doc_id: str) -> None:
    es_url = _require_es_url()
    async with httpx.AsyncClient(timeout=ES_TIMEOUT, auth=_auth()) as client:
        resp = await client.delete(f"{es_url}/{ES_INDEX}/_doc/{doc_id}")
        if resp.status_code in (200, 404):
            return
        resp.raise_for_status()
