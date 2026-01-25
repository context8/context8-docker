from typing import Any
import os
import hashlib
import random
import httpx

EMBEDDING_API_URL = os.environ.get("EMBEDDING_API_URL")
EMBEDDING_TIMEOUT = float(os.environ.get("EMBEDDING_TIMEOUT", "10"))
EMBEDDING_STRICT = os.environ.get("EMBEDDING_STRICT", "false").lower() in ("1", "true", "yes")

def _embedding_dim() -> int:
    try:
        return int(os.environ.get("EMBEDDING_DIM", "384"))
    except Exception:
        return 384


def _normalize_payload(data: Any) -> str:
    """Flatten incoming payload into a stable string."""
    if data is None:
        return ""
    if isinstance(data, dict):
        # keep deterministic ordering by sorting keys
        parts = []
        for key in sorted(data.keys()):
            val = data[key]
            if val is None:
                continue
            parts.append(f"{key}:{val}")
        return " | ".join(parts)
    return str(data)


async def _embed_via_service(text: str) -> list[float]:
    async with httpx.AsyncClient(timeout=EMBEDDING_TIMEOUT) as client:
        resp = await client.post(EMBEDDING_API_URL, json={"text": text})
        resp.raise_for_status()
        payload = resp.json()
    vec = payload.get("embedding")
    if not isinstance(vec, list):
        raise ValueError("embedding service returned invalid payload")
    return vec


def _fallback_embedding(normalized: str) -> list[float]:
    dim = _embedding_dim()
    if not normalized:
        return [0.0] * dim
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    seed = int(digest[:16], 16)
    rng = random.Random(seed)
    return [rng.uniform(-1.0, 1.0) for _ in range(dim)]


async def embed_text(data: Any) -> list[float]:
    normalized = _normalize_payload(data)
    if not normalized:
        return [0.0] * _embedding_dim()

    if EMBEDDING_API_URL:
        try:
            vec = await _embed_via_service(normalized)
            return vec
        except Exception as exc:
            if EMBEDDING_STRICT:
                raise
            print(f"[embeddings] service failed, fallback to deterministic: {exc}")

    return _fallback_embedding(normalized)
