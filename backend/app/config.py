import os

_WEAK_SECRET_VALUES = {"change_me", "changeme", "replace_me", "replace-this", "default"}


def _require_secret(name: str) -> str:
    value = (os.environ.get(name) or "").strip()
    if not value:
        raise RuntimeError(f"{name} is required")
    if value.lower() in _WEAK_SECRET_VALUES:
        raise RuntimeError(f"{name} uses an insecure placeholder value")
    return value


API_KEY_SECRET = _require_secret("API_KEY_SECRET")
JWT_SECRET = _require_secret("JWT_SECRET")
JWT_ALG = "HS256"
