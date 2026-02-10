from __future__ import annotations

from typing import Any


def solution_to_es_doc(solution: Any, embedding: list[float] | None = None) -> dict[str, Any]:
    doc: dict[str, Any] = {
        "id": solution.id,
        "user_id": solution.user_id,
        "api_key_id": solution.api_key_id,
        "title": solution.title,
        "error_message": solution.error_message,
        "error_type": solution.error_type,
        "context": solution.context,
        "root_cause": solution.root_cause,
        "solution": solution.solution,
        "code_changes": solution.code_changes,
        "tags": solution.tags or [],
        "conversation_language": solution.conversation_language,
        "programming_language": solution.programming_language,
        "vibecoding_software": solution.vibecoding_software,
        "project_path": solution.project_path,
        "environment": solution.environment,
        "visibility": solution.visibility,
        "upvotes": int(solution.upvotes or 0),
        "downvotes": int(solution.downvotes or 0),
        "created_at": solution.created_at.isoformat() if solution.created_at else None,
    }
    if embedding is not None:
        doc["embedding"] = embedding
    return doc
