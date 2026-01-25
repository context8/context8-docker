VISIBILITY_PRIVATE = "private"
VISIBILITY_TEAM = "team"
VISIBILITY_VALUES = (VISIBILITY_PRIVATE, VISIBILITY_TEAM)


def normalize_visibility(value: str | None) -> str | None:
    if value is None:
        return None
    lowered = value.lower().strip()
    if lowered in VISIBILITY_VALUES:
        return lowered
    raise ValueError(f"Invalid visibility: {value}")
