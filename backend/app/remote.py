import os
from typing import Any
from urllib.parse import urlparse

import httpx
from fastapi import HTTPException


REMOTE_CONTEXT8_BASE = os.environ.get("REMOTE_CONTEXT8_BASE")
REMOTE_CONTEXT8_API_KEY = os.environ.get("REMOTE_CONTEXT8_API_KEY")
REMOTE_CONTEXT8_ALLOW_OVERRIDE = os.environ.get("REMOTE_CONTEXT8_ALLOW_OVERRIDE", "false").lower() in ("1", "true", "yes")
REMOTE_CONTEXT8_TIMEOUT = float(os.environ.get("REMOTE_CONTEXT8_TIMEOUT", "6"))
REMOTE_CONTEXT8_ALLOWED_HOSTS = {
    item.strip().lower()
    for item in (os.environ.get("REMOTE_CONTEXT8_ALLOWED_HOSTS") or "").split(",")
    if item.strip()
}


def _normalize_base(value: str | None) -> str | None:
    if not value:
        return None
    return value.rstrip("/")


def _host_from_base(base: str) -> str | None:
    parsed = urlparse(base)
    return parsed.hostname.lower() if parsed.hostname else None


def _is_local_host(hostname: str) -> bool:
    return hostname in {"localhost", "127.0.0.1", "::1"}


def _validate_remote_host(base_host: str, override_active: bool) -> None:
    if REMOTE_CONTEXT8_ALLOWED_HOSTS:
        if base_host not in REMOTE_CONTEXT8_ALLOWED_HOSTS:
            raise HTTPException(status_code=403, detail="Remote base host is not allowed")
        return
    if override_active and not _is_local_host(base_host):
        raise HTTPException(
            status_code=403,
            detail="Remote override is limited to localhost unless REMOTE_CONTEXT8_ALLOWED_HOSTS is configured",
        )


def resolve_remote_config(override_base: str | None, override_key: str | None) -> tuple[str, str]:
    override_active = bool(REMOTE_CONTEXT8_ALLOW_OVERRIDE and override_base)
    base = _normalize_base(override_base if override_active else None) or _normalize_base(REMOTE_CONTEXT8_BASE)
    api_key = (override_key if REMOTE_CONTEXT8_ALLOW_OVERRIDE else None) or REMOTE_CONTEXT8_API_KEY

    if not base:
        raise HTTPException(status_code=400, detail="Remote base not configured")
    if not api_key:
        raise HTTPException(status_code=401, detail="Remote API key not configured")
    if not (base.startswith("http://") or base.startswith("https://")):
        raise HTTPException(status_code=400, detail="Remote base must start with http:// or https://")
    base_host = _host_from_base(base)
    if not base_host:
        raise HTTPException(status_code=400, detail="Remote base host is invalid")
    _validate_remote_host(base_host, override_active)
    return base, api_key


async def remote_search(base: str, api_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=REMOTE_CONTEXT8_TIMEOUT) as client:
        resp = await client.post(
            f"{base}/search",
            json=payload,
            headers={"X-API-Key": api_key, "Content-Type": "application/json"},
        )
        if resp.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"Remote search failed: {resp.text}")
        return resp.json()
