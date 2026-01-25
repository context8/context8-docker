import asyncio
import os
import time
from datetime import datetime, timezone

from redis import Redis
from rq import Queue, Retry, get_current_job
from sqlalchemy import select

from .database import AsyncSessionLocal
from .embeddings import embed_text
from .es import update_solution_es, delete_solution_es
from .models import Solution
from .vector import add_vector


REDIS_URL = os.environ.get("REDIS_URL")
EMBED_QUEUE_NAME = os.environ.get("EMBED_QUEUE_NAME", "embedding")
ES_QUEUE_NAME = os.environ.get("ES_QUEUE_NAME", "es_sync")
EMBEDDING_JOB_TIMEOUT = int(os.environ.get("EMBEDDING_JOB_TIMEOUT", "120"))
EMBEDDING_RETRY_MAX = int(os.environ.get("EMBEDDING_RETRY_MAX", "3"))
EMBEDDING_RETRY_INTERVALS = os.environ.get("EMBEDDING_RETRY_INTERVALS", "5,15,30")
EMBEDDING_METRICS_PREFIX = os.environ.get("EMBEDDING_METRICS_PREFIX", "context8:embedding")
ES_JOB_TIMEOUT = int(os.environ.get("ES_JOB_TIMEOUT", "15"))
ES_RETRY_MAX = int(os.environ.get("ES_RETRY_MAX", "5"))
ES_RETRY_INTERVALS = os.environ.get("ES_RETRY_INTERVALS", "1,2,4")
ES_METRICS_PREFIX = os.environ.get("ES_METRICS_PREFIX", "context8:es_sync")


def _parse_retry_intervals(raw: str) -> list[int]:
    intervals: list[int] = []
    for part in raw.split(","):
        part = part.strip()
        if not part:
            continue
        try:
            value = int(part)
        except ValueError:
            continue
        if value > 0:
            intervals.append(value)
    return intervals or [5, 15, 30]


def _get_queue(name: str, timeout: int) -> Queue:
    if not REDIS_URL:
        raise RuntimeError("REDIS_URL is not set")
    connection = Redis.from_url(REDIS_URL)
    return Queue(name, connection=connection, default_timeout=timeout)


def _get_metrics_connection() -> Redis | None:
    if not REDIS_URL:
        return None
    try:
        return Redis.from_url(REDIS_URL)
    except Exception:
        return None


def _record_metric(prefix: str, event: str) -> None:
    conn = _get_metrics_connection()
    if not conn:
        return
    day = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    try:
        conn.incr(f"{prefix}:{event}:total")
        conn.hincrby(f"{prefix}:daily:{day}", event, 1)
        conn.expire(f"{prefix}:daily:{day}", 60 * 60 * 24 * 30)
    except Exception:
        return


def enqueue_embedding_task(solution_id: str) -> None:
    retry = Retry(max=EMBEDDING_RETRY_MAX, interval=_parse_retry_intervals(EMBEDDING_RETRY_INTERVALS))
    queue = _get_queue(EMBED_QUEUE_NAME, EMBEDDING_JOB_TIMEOUT)
    queue.enqueue(process_embedding_task, solution_id, retry=retry, job_timeout=EMBEDDING_JOB_TIMEOUT)


def enqueue_es_sync_task(solution_id: str) -> None:
    retry = Retry(max=ES_RETRY_MAX, interval=_parse_retry_intervals(ES_RETRY_INTERVALS))
    queue = _get_queue(ES_QUEUE_NAME, ES_JOB_TIMEOUT)
    queue.enqueue(process_es_sync_task, solution_id, retry=retry, job_timeout=ES_JOB_TIMEOUT)


def enqueue_es_delete_task(solution_id: str) -> None:
    retry = Retry(max=ES_RETRY_MAX, interval=_parse_retry_intervals(ES_RETRY_INTERVALS))
    queue = _get_queue(ES_QUEUE_NAME, ES_JOB_TIMEOUT)
    queue.enqueue(process_es_delete_task, solution_id, retry=retry, job_timeout=ES_JOB_TIMEOUT)


def process_embedding_task(solution_id: str) -> None:
    asyncio.run(_process_embedding_task_async(solution_id))


def process_es_sync_task(solution_id: str) -> None:
    asyncio.run(_process_es_sync_task_async(solution_id))


def process_es_delete_task(solution_id: str) -> None:
    asyncio.run(_process_es_delete_task_async(solution_id))


def _build_embedding_payload(solution: Solution) -> dict:
    return {
        "title": solution.title,
        "errorMessage": solution.error_message,
        "errorType": solution.error_type,
        "context": solution.context,
        "rootCause": solution.root_cause,
        "solution": solution.solution,
        "tags": solution.tags or [],
        "environment": solution.environment,
    }


def _build_es_doc(solution: Solution, include_embedding: bool = True) -> dict:
    doc = {
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
    if include_embedding and solution.embedding is not None:
        doc["embedding"] = [float(x) for x in solution.embedding]
    return doc


async def _process_embedding_task_async(solution_id: str) -> None:
    start = time.monotonic()
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Solution).where(Solution.id == solution_id))
        sol = res.scalar_one_or_none()
        if not sol:
            return
        if sol.embedding_status == "done":
            return

        sol.embedding_status = "processing"
        sol.embedding_error = None
        await session.commit()

        try:
            vector = await embed_text(_build_embedding_payload(sol))
            await add_vector(session, sol.id, vector)
        except Exception as exc:
            error_msg = str(exc) or exc.__class__.__name__
            sol.embedding_status = "failed"
            sol.embedding_error = error_msg
            sol.embedding_updated_at = datetime.now(timezone.utc)
            await session.commit()
            job = get_current_job()
            retries_left = getattr(job, "retries_left", None) if job else None
            if retries_left:
                _record_metric(EMBEDDING_METRICS_PREFIX, "retry")
            else:
                _record_metric(EMBEDDING_METRICS_PREFIX, "failed")
            print(f"[worker] embedding failed for {solution_id} retries_left={retries_left} err={error_msg}")
            raise

        sol.embedding_status = "done"
        sol.embedding_error = None
        sol.embedding_updated_at = datetime.now(timezone.utc)
        await session.commit()
        _record_metric(EMBEDDING_METRICS_PREFIX, "success")
        elapsed_ms = int((time.monotonic() - start) * 1000)
        print(f"[worker] embedding done for {solution_id} in {elapsed_ms}ms")
        vector_payload = [float(x) for x in vector]

    try:
        await update_solution_es(solution_id, {"embedding": vector_payload})
    except Exception as exc:
        _record_metric(EMBEDDING_METRICS_PREFIX, "es_failed")
        print(f"[worker] es embedding update failed for {solution_id}: {exc}")


async def _process_es_sync_task_async(solution_id: str) -> None:
    start = time.monotonic()
    async with AsyncSessionLocal() as session:
        res = await session.execute(select(Solution).where(Solution.id == solution_id))
        sol = res.scalar_one_or_none()
        if not sol:
            return
        es_doc = _build_es_doc(sol, include_embedding=True)

    try:
        await update_solution_es(solution_id, es_doc)
    except Exception as exc:
        job = get_current_job()
        retries_left = getattr(job, "retries_left", None) if job else None
        if retries_left:
            _record_metric(ES_METRICS_PREFIX, "retry")
        else:
            _record_metric(ES_METRICS_PREFIX, "failed")
        print(f"[worker] es sync failed for {solution_id} retries_left={retries_left} err={exc}")
        raise
    _record_metric(ES_METRICS_PREFIX, "success")
    elapsed_ms = int((time.monotonic() - start) * 1000)
    print(f"[worker] es sync done for {solution_id} in {elapsed_ms}ms")


async def _process_es_delete_task_async(solution_id: str) -> None:
    start = time.monotonic()
    try:
        await delete_solution_es(solution_id)
    except Exception as exc:
        job = get_current_job()
        retries_left = getattr(job, "retries_left", None) if job else None
        if retries_left:
            _record_metric(ES_METRICS_PREFIX, "retry")
        else:
            _record_metric(ES_METRICS_PREFIX, "failed")
        print(f"[worker] es delete failed for {solution_id} retries_left={retries_left} err={exc}")
        raise
    _record_metric(ES_METRICS_PREFIX, "success")
    elapsed_ms = int((time.monotonic() - start) * 1000)
    print(f"[worker] es delete done for {solution_id} in {elapsed_ms}ms")
