import asyncio
import json
import os
import re
import time
import uuid
from datetime import datetime, timezone
from typing import List
from fastapi import FastAPI, Depends, HTTPException, Header, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
import httpx
from .database import Base, engine, get_session
from .schemas import (
  SolutionCreate,
  SolutionOut,
  SolutionListItem,
  PaginatedSolutions,
  SearchRequest,
  SearchResponse,
  SearchResult,
  CountResponse,
  ChatRequest,
  ChatResponse,
  OpenAIChatRequest,
  SolutionVisibilityUpdate,
  SolutionVisibilityOut,
  VoteRequest,
  VoteResponse,
)
from .crud import (
  create_solution,
  get_solution,
  list_solutions,
  delete_solution,
  count_accessible_solutions,
  update_solution_visibility,
  get_solution_vote,
  set_solution_vote,
  clear_solution_vote,
)
from .es import (
  search_solutions_es,
  fetch_solution_es,
  index_solution_es,
  update_solution_es,
  delete_solution_es,
)
from .embeddings import embed_text
from .api_keys import router as apikey_router, resolve_api_keys, list_active_api_keys, ApiKey
from .users import User
from jose import jwt
from .config import JWT_SECRET, JWT_ALG, OPENROUTER_API_KEY, OPENROUTER_BASE_URL, OPENROUTER_MODEL, OPENROUTER_TITLE, EMAIL_VERIFICATION_ENABLED
from .visibility import VISIBILITY_PRIVATE, normalize_visibility
from .auth import (
    send_code,
    verify_code,
    SendCodeRequest,
    VerifyCodeRequest,
    SessionResponse,
    UserResponse,
    AdminSetupRequest,
    LoginRequest,
    ensure_user,
    admin_exists,
    setup_admin,
    login,
)
from fastapi import APIRouter, Request

app = FastAPI(title="Context8 Cloud API", version="1.0.0")

def _parse_csv_env(name: str) -> list[str] | None:
  raw = os.environ.get(name)
  if not raw:
    return None
  items = [part.strip() for part in raw.split(",") if part.strip()]
  return items or None


cors_origins = _parse_csv_env("CORS_ALLOW_ORIGINS") or ["*"]
cors_origin_regex = os.environ.get("CORS_ALLOW_ORIGIN_REGEX")
cors_allow_credentials = os.environ.get("CORS_ALLOW_CREDENTIALS", "").lower() in ("1", "true", "yes")

app.add_middleware(
  CORSMiddleware,
  allow_origins=cors_origins,
  allow_origin_regex=cors_origin_regex,
  allow_credentials=cors_allow_credentials,
  allow_methods=["*"],
  allow_headers=["*"],
)

SYSTEM_PROMPT = (
  "You are the Context8 Demo assistant.\\n"
  "Behavior:\\n"
  "- When a user reports a bug, error, crash, or exception, you MUST use the searchSolutions tool before answering.\\n"
  "- Use the tool results to ground your response. If no results, say so and ask a targeted follow-up.\\n"
  "- Keep answers concise and actionable.\\n"
  "- Never fabricate solutions that are not in the tool results."
)

SEARCH_ES_TIMEOUT = float(os.environ.get("SEARCH_ES_TIMEOUT", "3"))
SEARCH_EMBED_TIMEOUT = float(os.environ.get("SEARCH_EMBED_TIMEOUT", "4"))

TOOL_DEF = {
  "type": "function",
  "function": {
    "name": "searchSolutions",
    "description": "Search Context8 solutions database for relevant bug fixes.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {"type": "string", "description": "User bug description or error message."},
        "limit": {"type": "integer", "description": "Max number of results", "default": 5},
      },
      "required": ["query"],
    },
  },
}

def _needs_search(prompt: str) -> bool:
  return bool(re.search(r"\\b(error|bug|crash|exception|traceback|stack trace|failed|failure|issue)\\b", prompt, re.I))

def _knn_enabled() -> bool:
  try:
    return float(os.environ.get("ES_KNN_WEIGHT", "0")) > 0
  except Exception:
    return False

def _timing_enabled() -> bool:
  return os.environ.get("TIMING_LOGS", "").lower() in ("1", "true", "yes")


def _normalize_es_tags(value) -> list[str]:
  if isinstance(value, list):
    return value
  if isinstance(value, str):
    try:
      parsed = json.loads(value)
      return parsed if isinstance(parsed, list) else []
    except Exception:
      return []
  return []


def _build_embedding_payload(query: str) -> dict:
  return {
    "title": query,
    "errorMessage": query,
    "context": query,
    "rootCause": query,
    "solution": query,
    "tags": [],
    "environment": None
  }


async def _embed_query(query: str) -> list[float] | None:
  try:
    return await asyncio.wait_for(
      embed_text(_build_embedding_payload(query)),
      timeout=SEARCH_EMBED_TIMEOUT,
    )
  except asyncio.TimeoutError:
    print(f"embed timed out after {SEARCH_EMBED_TIMEOUT}s, falling back")
  except Exception as e:
    print(f"embed failed, falling back: {e}")
  return None


async def _search_es(
  query: str,
  api_key_ids: list[str],
  allow_team: bool,
  allow_admin: bool,
  limit: int,
  offset: int,
  vector: list[float] | None,
  visibility: str | None,
):
  try:
    resp = await asyncio.wait_for(
      search_solutions_es(
        query,
        api_key_ids,
        allow_team,
        allow_admin,
        limit,
        offset,
        vector,
        visibility,
      ),
      timeout=SEARCH_ES_TIMEOUT,
    )
  except asyncio.TimeoutError as exc:
    raise HTTPException(
      status_code=503, detail=f"Elasticsearch timed out after {SEARCH_ES_TIMEOUT}s"
    ) from exc
  except Exception as exc:
    raise HTTPException(status_code=502, detail=f"Elasticsearch search failed: {exc}") from exc

  if not resp:
    raise HTTPException(status_code=503, detail="Elasticsearch is not configured (ES_URL missing)")
  return resp

async def _search_for_user(
  db: AsyncSession,
  api_key_ids: list[str],
  allow_team: bool,
  allow_admin: bool,
  query: str,
  limit: int,
  visibility: str | None = None,
) -> SearchResponse:
  vector = None
  knn_enabled = _knn_enabled()
  if knn_enabled:
    vector = await _embed_query(query)

  es_resp = await _search_es(
    query,
    api_key_ids,
    allow_team,
    allow_admin,
    max(limit, 0),
    0,
    vector if knn_enabled else None,
    visibility,
  )

  hits = es_resp.get("hits", {}).get("hits", [])
  results: list[SearchResult] = []
  for hit in hits:
    source = hit.get("_source", {})
    preview_msg = source.get("error_message", "") or ""
    preview_ctx = source.get("context", "") or ""
    results.append(
      SearchResult(
        id=source.get("id") or hit.get("_id"),
        title=source.get("title", ""),
        errorType=source.get("error_type", ""),
        tags=_normalize_es_tags(source.get("tags")),
        createdAt=source.get("created_at"),
        preview=f"{preview_msg[:80]}{'...' if len(preview_msg) > 80 else ''} | {preview_ctx[:50]}",
        errorMessage=source.get("error_message"),
        solution=source.get("solution"),
        visibility=source.get("visibility"),
        apiKeyId=source.get("api_key_id"),
        vibecodingSoftware=source.get("vibecoding_software"),
        upvotes=source.get("upvotes"),
        downvotes=source.get("downvotes"),
        voteScore=(source.get("upvotes") or 0) - (source.get("downvotes") or 0),
      )
    )

  total = es_resp.get("hits", {}).get("total", {}).get("value", len(results))

  if results:
    if os.environ.get("SEARCH_DEBUG", "").lower() in ("1", "true", "yes"):
      print(f"search:es_hit results={len(results)}")

  return SearchResponse(total=total, results=results)


def _split_api_keys(x_api_key: str | None, x_api_keys: str | None) -> list[str]:
  raw_keys: list[str] = []
  if x_api_key:
    raw_keys.append(x_api_key)
  if x_api_keys:
    raw_keys.extend([item.strip() for item in x_api_keys.split(",") if item.strip()])
  return raw_keys


async def require_verified_user(
  authorization: str | None = Header(default=None),
  x_api_key: str | None = Header(default=None),
  db: AsyncSession = Depends(get_session),
) -> str:
  """Require an authenticated, email-verified user."""
  user_id = None

  if authorization and authorization.startswith("Bearer "):
    token = authorization.split(" ", 1)[1]
    try:
      data = jwt.decode(
        token,
        JWT_SECRET,
        algorithms=[JWT_ALG],
        audience="context8-api",
        issuer="context8.com",
      )
      user_id = data.get("sub")
    except Exception:
      print("[auth] bearer decode failed")
      key_items = await resolve_api_keys(db, [token])
      if key_items:
        user_id = str(key_items[0].user_id)
      else:
        print("[auth] bearer api key not resolved")

  if not user_id and x_api_key:
    key_items = await resolve_api_keys(db, [x_api_key])
    if key_items:
      user_id = str(key_items[0].user_id)
    else:
      print("[auth] api key not resolved")

  if not user_id:
    print(f"[auth] unauthorized headers auth={authorization} x-api-key-present={bool(x_api_key)}")
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

  await ensure_user(db, user_id)
  return user_id


async def require_solution_read_scope(
  authorization: str | None = Header(default=None),
  x_api_key: str | None = Header(default=None),
  x_api_keys: str | None = Header(default=None),
  db: AsyncSession = Depends(get_session),
) -> dict:
  raw_keys = _split_api_keys(x_api_key, x_api_keys)
  api_key_ids: list[str] = []
  allow_team = False
  allow_admin = False
  user_id = None
  jwt_user_id: str | None = None
  key_user_id: str | None = None

  if authorization and authorization.startswith("Bearer "):
    token = authorization.split(" ", 1)[1]
    try:
      data = jwt.decode(
        token,
        JWT_SECRET,
        algorithms=[JWT_ALG],
        audience="context8-api",
        issuer="context8.com",
      )
      jwt_user_id = data.get("sub")
    except Exception:
      raw_keys.append(token)

  if raw_keys:
    key_items = await resolve_api_keys(db, raw_keys)
    if not key_items:
      print("[auth] api key not resolved")
      raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    key_user_id = str(key_items[0].user_id)
    api_key_ids = [item.id for item in key_items]

  if jwt_user_id and key_user_id and jwt_user_id != key_user_id:
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="API key does not belong to user")

  user_id = jwt_user_id or key_user_id
  if user_id:
    user = await ensure_user(db, user_id)
    allow_team = True
    allow_admin = bool(user.is_admin) and bool(jwt_user_id)
    if not api_key_ids:
      key_items = await list_active_api_keys(db, user_id)
      api_key_ids = [item.id for item in key_items]

  if not user_id and not raw_keys:
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

  return {
    "user_id": user_id,
    "api_key_ids": api_key_ids,
    "allow_team": allow_team,
    "allow_admin": allow_admin,
  }


async def require_solution_write_scope(
  authorization: str | None = Header(default=None),
  x_api_key: str | None = Header(default=None),
  x_api_keys: str | None = Header(default=None),
  db: AsyncSession = Depends(get_session),
) -> dict:
  raw_keys = _split_api_keys(x_api_key, x_api_keys)
  jwt_user_id: str | None = None
  if len(raw_keys) > 1:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Multiple API keys not allowed for write")

  if raw_keys:
    key_items = await resolve_api_keys(db, raw_keys)
    if not key_items:
      raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
    key_item = key_items[0]
    user = await ensure_user(db, str(key_item.user_id))
    return {
      "user_id": str(key_item.user_id),
      "api_key": key_item,
      "api_key_ids": [key_item.id],
      "allow_admin": False,
    }

  if authorization and authorization.startswith("Bearer "):
    token = authorization.split(" ", 1)[1]
    try:
      data = jwt.decode(
        token,
        JWT_SECRET,
        algorithms=[JWT_ALG],
        audience="context8-api",
        issuer="context8.com",
      )
      jwt_user_id = data.get("sub")
    except Exception:
      key_items = await resolve_api_keys(db, [token])
      if key_items:
        key_item = key_items[0]
        user = await ensure_user(db, str(key_item.user_id))
        return {
          "user_id": str(key_item.user_id),
          "api_key": key_item,
          "allow_admin": False,
        }
      raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    user = await ensure_user(db, str(jwt_user_id))
    key_items = await list_active_api_keys(db, str(jwt_user_id))
    if not key_items:
      raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="API key required for write")
    return {
      "user_id": str(jwt_user_id),
      "api_key": key_items[0],
      "api_key_ids": [item.id for item in key_items],
      "allow_admin": bool(user.is_admin),
    }

  raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")


# Create auth router for admin setup/login
auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.get("/status")
async def auth_status(db: AsyncSession = Depends(get_session)):
  return {"adminExists": await admin_exists(db)}


@auth_router.post("/setup", response_model=SessionResponse)
async def setup_admin_account(
  payload: AdminSetupRequest,
  db: AsyncSession = Depends(get_session),
):
  return await setup_admin(payload, db)


@auth_router.post("/login", response_model=SessionResponse)
async def login_account(
  payload: LoginRequest,
  db: AsyncSession = Depends(get_session),
):
  return await login(payload, db)


# Create new auth router for email verification
email_auth_router = APIRouter(prefix="/auth/email", tags=["email-auth"])

@email_auth_router.post("/send-code")
async def send_verification_code(
    request: SendCodeRequest,
    req: Request,
    db: AsyncSession = Depends(get_session)
):
    """Send verification code to email."""
    return await send_code(request, req, db)

@email_auth_router.post("/verify-code", response_model=SessionResponse)
async def verify_verification_code(
    request: VerifyCodeRequest,
    req: Request,
    db: AsyncSession = Depends(get_session)
):
    """Verify code and get session token."""
    return await verify_code(request, req, db)

@email_auth_router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    user_id: str = Depends(require_verified_user),
    db: AsyncSession = Depends(get_session)
):
    """Get current user information."""
    try:
        user_uuid = uuid.UUID(str(user_id))
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

    result = await db.execute(select(User).where(User.id == user_uuid))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserResponse(
        id=str(user.id),
        email=user.email,
        emailVerified=user.email_verified
    )

app.include_router(apikey_router)
app.include_router(auth_router)
app.include_router(email_auth_router)

@app.on_event("startup")
async def on_startup():
  async with engine.begin() as conn:
    # Enable required PostgreSQL extensions
    await conn.execute(text("CREATE EXTENSION IF NOT EXISTS citext"))
    await conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector"))
    await conn.run_sync(Base.metadata.create_all)


@app.post("/solutions", response_model=SolutionOut, response_model_exclude={"embedding"})
async def save_solution(
  payload: SolutionCreate,
  db: AsyncSession = Depends(get_session),
  scope: dict = Depends(require_solution_write_scope),
):
  start = time.perf_counter()
  key_item: ApiKey = scope["api_key"]
  user_id = scope["user_id"]
  try:
    visibility = normalize_visibility(payload.visibility) or VISIBILITY_PRIVATE
  except ValueError as exc:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
  sol = await create_solution(db, payload, key_item.id, user_id, visibility)
  db_ms = (time.perf_counter() - start) * 1000

  embedding: list[float] | None = None
  embed_ms = 0.0
  if _knn_enabled():
    embed_start = time.perf_counter()
    try:
      embedding = await asyncio.wait_for(
        embed_text(
          {
            "title": sol.title,
            "errorMessage": sol.error_message,
            "errorType": sol.error_type,
            "context": sol.context,
            "rootCause": sol.root_cause,
            "solution": sol.solution,
            "tags": sol.tags or [],
            "environment": sol.environment,
          }
        ),
        timeout=SEARCH_EMBED_TIMEOUT,
      )
      sol.embedding_status = "done"
      sol.embedding_error = None
    except Exception as exc:
      sol.embedding_status = "failed"
      sol.embedding_error = str(exc) or exc.__class__.__name__
    sol.embedding_updated_at = datetime.now(timezone.utc)
    await db.commit()
    embed_ms = (time.perf_counter() - embed_start) * 1000
  else:
    sol.embedding_status = "skipped"
    sol.embedding_error = None
    sol.embedding_updated_at = datetime.now(timezone.utc)
    await db.commit()

  es_start = time.perf_counter()
  try:
    doc: dict = {
      "id": sol.id,
      "user_id": sol.user_id,
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
      "upvotes": int(sol.upvotes or 0),
      "downvotes": int(sol.downvotes or 0),
      "created_at": sol.created_at.isoformat() if sol.created_at else None,
    }
    if embedding is not None:
      doc["embedding"] = embedding
    await index_solution_es(sol.id, doc)
  except Exception as exc:
    # Elasticsearch is the only search source in docker-light; avoid persisting unsearchable rows.
    try:
      await db.delete(sol)
      await db.commit()
    except Exception:
      await db.rollback()
    raise HTTPException(status_code=502, detail=f"Failed to index solution in Elasticsearch: {exc}") from exc
  es_ms = (time.perf_counter() - es_start) * 1000

  if _timing_enabled():
    total_ms = (time.perf_counter() - start) * 1000
    print(
      "timing:create_solution "
      f"id={sol.id} db_ms={db_ms:.2f} embed_ms={embed_ms:.2f} "
      f"es_ms={es_ms:.2f} total_ms={total_ms:.2f}"
    )

  return SolutionOut(
    id=sol.id,
    title=sol.title,
    errorMessage=sol.error_message,
    errorType=sol.error_type,
    context=sol.context,
    rootCause=sol.root_cause,
    solution=sol.solution,
    codeChanges=sol.code_changes,
    tags=sol.tags,
    conversationLanguage=sol.conversation_language,
    programmingLanguage=sol.programming_language,
    vibecodingSoftware=sol.vibecoding_software,
    visibility=sol.visibility,
    upvotes=int(sol.upvotes or 0),
    downvotes=int(sol.downvotes or 0),
    voteScore=int((sol.upvotes or 0) - (sol.downvotes or 0)),
    myVote=None,
    projectPath=sol.project_path,
    environment=sol.environment,
    embedding=sol.embedding,
    embedding_status=sol.embedding_status,
    embedding_error=sol.embedding_error,
    embedding_updated_at=sol.embedding_updated_at,
    createdAt=sol.created_at,
  )


@app.get("/solutions", response_model=PaginatedSolutions)
async def list_user_solutions(
  limit: int = 25,
  offset: int = 0,
  visibility: str | None = None,
  db: AsyncSession = Depends(get_session),
  scope: dict = Depends(require_solution_read_scope),
):
  try:
    visibility_filter = normalize_visibility(visibility) if visibility else None
  except ValueError as exc:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
  total, items = await list_solutions(
    db,
    scope["api_key_ids"],
    scope["allow_team"],
    scope.get("allow_admin", False),
    limit,
    offset,
    visibility_filter,
  )
  return PaginatedSolutions(
    items=[
      SolutionListItem(
        id=i.id,
        title=i.title,
        errorMessage=i.error_message,
        errorType=i.error_type,
        tags=i.tags,
        conversationLanguage=i.conversation_language,
        programmingLanguage=i.programming_language,
        vibecodingSoftware=i.vibecoding_software,
        visibility=i.visibility,
        upvotes=i.upvotes,
        downvotes=i.downvotes,
        voteScore=(i.upvotes or 0) - (i.downvotes or 0),
        createdAt=i.created_at,
      )
      for i in items
    ],
    total=total,
    limit=limit,
    offset=offset,
  )


@app.get("/solutions/count", response_model=CountResponse)
async def count_user_solutions(
  visibility: str | None = None,
  db: AsyncSession = Depends(get_session),
  scope: dict = Depends(require_solution_read_scope),
):
  try:
    visibility_filter = normalize_visibility(visibility) if visibility else None
  except ValueError as exc:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
  total = await count_accessible_solutions(
    db,
    scope["api_key_ids"],
    scope["allow_team"],
    scope.get("allow_admin", False),
    visibility_filter,
  )
  return CountResponse(total=total)


@app.get("/solutions/{solution_id}", response_model=SolutionOut, response_model_exclude={"embedding"})
async def fetch_solution(
  solution_id: str,
  db: AsyncSession = Depends(get_session),
  scope: dict = Depends(require_solution_read_scope),
):
  sol = await get_solution(
    db,
    solution_id,
    scope["api_key_ids"],
    scope["allow_team"],
    scope.get("allow_admin", False),
  )
  if not sol:
    raise HTTPException(status_code=404, detail="Not found")
  my_vote = None
  if scope.get("user_id"):
    try:
      my_vote = await get_solution_vote(db, sol.id, scope["user_id"])
    except Exception:
      my_vote = None
  return SolutionOut(
    id=sol.id,
    title=sol.title,
    errorMessage=sol.error_message,
    errorType=sol.error_type,
    context=sol.context,
    rootCause=sol.root_cause,
    solution=sol.solution,
    codeChanges=sol.code_changes,
    tags=sol.tags,
    conversationLanguage=sol.conversation_language,
    programmingLanguage=sol.programming_language,
    vibecodingSoftware=sol.vibecoding_software,
    visibility=sol.visibility,
    upvotes=int(sol.upvotes or 0),
    downvotes=int(sol.downvotes or 0),
    voteScore=int((sol.upvotes or 0) - (sol.downvotes or 0)),
    myVote=my_vote,
    projectPath=sol.project_path,
    environment=sol.environment,
    embedding=sol.embedding,
    embedding_status=sol.embedding_status,
    embedding_error=sol.embedding_error,
    embedding_updated_at=sol.embedding_updated_at,
    createdAt=sol.created_at,
  )


@app.get("/solutions/{solution_id}/es", response_model=SolutionOut, response_model_exclude={"embedding"})
async def fetch_solution_es_detail(
  solution_id: str,
  scope: dict = Depends(require_solution_read_scope),
):
  source = await fetch_solution_es(
    solution_id,
    scope["api_key_ids"],
    scope["allow_team"],
    scope.get("allow_admin", False),
  )
  if not source:
    raise HTTPException(status_code=404, detail="Not found")
  return SolutionOut(
    id=source.get("id") or solution_id,
    title=source.get("title") or "",
    errorMessage=source.get("error_message") or "",
    errorType=source.get("error_type") or "",
    context=source.get("context") or "",
    rootCause=source.get("root_cause") or "",
    solution=source.get("solution") or "",
    codeChanges=source.get("code_changes"),
    tags=source.get("tags") or [],
    conversationLanguage=source.get("conversation_language"),
    programmingLanguage=source.get("programming_language"),
    vibecodingSoftware=source.get("vibecoding_software"),
    visibility=source.get("visibility"),
    upvotes=int(source.get("upvotes") or 0),
    downvotes=int(source.get("downvotes") or 0),
    voteScore=int((source.get("upvotes") or 0) - (source.get("downvotes") or 0)),
    myVote=None,
    projectPath=source.get("project_path"),
    environment=source.get("environment"),
    embedding=None,
    embedding_status=None,
    embedding_error=None,
    embedding_updated_at=None,
    createdAt=source.get("created_at"),
  )


@app.post("/solutions/{solution_id}/vote", response_model=VoteResponse)
async def vote_solution(
  solution_id: str,
  payload: VoteRequest,
  db: AsyncSession = Depends(get_session),
  scope: dict = Depends(require_solution_read_scope),
):
  if not scope.get("user_id"):
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

  sol = await get_solution(
    db,
    solution_id,
    scope["api_key_ids"],
    scope["allow_team"],
    scope.get("allow_admin", False),
  )
  if not sol:
    raise HTTPException(status_code=404, detail="Not found")

  try:
    my_vote = await set_solution_vote(db, sol, scope["user_id"], payload.value)
  except ValueError as exc:
    raise HTTPException(status_code=400, detail=str(exc))

  upvotes = int(sol.upvotes or 0)
  downvotes = int(sol.downvotes or 0)
  try:
    await update_solution_es(sol.id, {"upvotes": upvotes, "downvotes": downvotes})
  except Exception as exc:
    print(f"es vote sync failed for {sol.id}: {exc}")
  return VoteResponse(
    solutionId=sol.id,
    upvotes=upvotes,
    downvotes=downvotes,
    voteScore=upvotes - downvotes,
    myVote=my_vote,
  )


@app.delete("/solutions/{solution_id}/vote", response_model=VoteResponse)
async def clear_vote_solution(
  solution_id: str,
  db: AsyncSession = Depends(get_session),
  scope: dict = Depends(require_solution_read_scope),
):
  if not scope.get("user_id"):
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")

  sol = await get_solution(
    db,
    solution_id,
    scope["api_key_ids"],
    scope["allow_team"],
    scope.get("allow_admin", False),
  )
  if not sol:
    raise HTTPException(status_code=404, detail="Not found")

  await clear_solution_vote(db, sol, scope["user_id"])
  upvotes = int(sol.upvotes or 0)
  downvotes = int(sol.downvotes or 0)
  try:
    await update_solution_es(sol.id, {"upvotes": upvotes, "downvotes": downvotes})
  except Exception as exc:
    print(f"es vote sync failed for {sol.id}: {exc}")
  return VoteResponse(
    solutionId=sol.id,
    upvotes=upvotes,
    downvotes=downvotes,
    voteScore=upvotes - downvotes,
    myVote=None,
  )


@app.delete("/solutions/{solution_id}")
async def delete_user_solution(
  solution_id: str,
  db: AsyncSession = Depends(get_session),
  scope: dict = Depends(require_solution_write_scope),
):
  api_key_ids = scope.get("api_key_ids", [])
  start = time.perf_counter()
  deleted = await delete_solution(db, solution_id, api_key_ids, scope.get("allow_admin", False))
  db_ms = (time.perf_counter() - start) * 1000
  if not deleted:
    raise HTTPException(status_code=404, detail="Not found")
  es_start = time.perf_counter()
  try:
    await delete_solution_es(solution_id)
  except Exception as exc:
    print(f"es delete failed for {solution_id}: {exc}")
  es_ms = (time.perf_counter() - es_start) * 1000
  total_ms = (time.perf_counter() - start) * 1000
  print(f"timing:delete_solution id={solution_id} db_ms={db_ms:.2f} es_ms={es_ms:.2f} total_ms={total_ms:.2f}")
  return {"status": "deleted"}


@app.patch("/solutions/{solution_id}/visibility", response_model=SolutionVisibilityOut)
async def set_solution_visibility(
  solution_id: str,
  payload: SolutionVisibilityUpdate,
  db: AsyncSession = Depends(get_session),
  scope: dict = Depends(require_solution_write_scope),
):
  api_key_ids = scope.get("api_key_ids", [])
  try:
    visibility = normalize_visibility(payload.visibility) or VISIBILITY_PRIVATE
  except ValueError as exc:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
  sol = await update_solution_visibility(
    db,
    solution_id,
    api_key_ids,
    visibility,
    scope.get("allow_admin", False),
  )
  if not sol:
    raise HTTPException(status_code=404, detail="Not found")
  try:
    await update_solution_es(sol.id, {"visibility": sol.visibility})
  except Exception as exc:
    print(f"es visibility sync failed for {sol.id}: {exc}")
  return SolutionVisibilityOut(id=sol.id, visibility=sol.visibility)


@app.post("/search", response_model=SearchResponse)
async def search(
  payload: SearchRequest,
  db: AsyncSession = Depends(get_session),
  scope: dict = Depends(require_solution_read_scope),
):
  start = time.perf_counter()
  try:
    visibility_filter = normalize_visibility(payload.visibility) if payload.visibility else None
  except ValueError as exc:
    raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

  vector = None
  knn_enabled = _knn_enabled()
  if knn_enabled:
    embed_start = time.perf_counter()
    vector = await _embed_query(payload.query)
    embed_ms = (time.perf_counter() - embed_start) * 1000
  else:
    embed_ms = 0.0

  es_start = time.perf_counter()
  es_resp = await _search_es(
    payload.query,
    scope["api_key_ids"],
    scope["allow_team"],
    scope.get("allow_admin", False),
    max(payload.limit, 0),
    payload.offset,
    vector if knn_enabled else None,
    visibility_filter,
  )
  es_ms = (time.perf_counter() - es_start) * 1000

  hits = es_resp.get("hits", {}).get("hits", [])
  results: list[SearchResult] = []
  for hit in hits:
    source = hit.get("_source", {})
    preview_msg = source.get("error_message", "") or ""
    preview_ctx = source.get("context", "") or ""
    results.append(
      SearchResult(
        id=source.get("id") or hit.get("_id"),
        title=source.get("title", ""),
        errorType=source.get("error_type", ""),
        tags=_normalize_es_tags(source.get("tags")),
        createdAt=source.get("created_at"),
        preview=f"{preview_msg[:80]}{'...' if len(preview_msg) > 80 else ''} | {preview_ctx[:50]}",
        errorMessage=source.get("error_message"),
        solution=source.get("solution"),
        visibility=source.get("visibility"),
        apiKeyId=source.get("api_key_id"),
        vibecodingSoftware=source.get("vibecoding_software"),
        upvotes=source.get("upvotes"),
        downvotes=source.get("downvotes"),
        voteScore=(source.get("upvotes") or 0) - (source.get("downvotes") or 0),
      )
    )

  total = es_resp.get("hits", {}).get("total", {}).get("value", len(results))

  if results:
    if os.environ.get("SEARCH_DEBUG", "").lower() in ("1", "true", "yes"):
      print(f"search:es_hit results={len(results)}")

  if _timing_enabled():
    total_ms = (time.perf_counter() - start) * 1000
    print(
      "timing:search path=es "
      f"embed_ms={embed_ms:.2f} es_ms={es_ms:.2f} total_ms={total_ms:.2f}"
    )

  return SearchResponse(total=total, results=results)


@app.post("/llm/chat", response_model=ChatResponse)
async def llm_chat(
  payload: ChatRequest,
  db: AsyncSession = Depends(get_session),
  scope: dict = Depends(require_solution_read_scope),
):
  if not OPENROUTER_API_KEY:
    raise HTTPException(status_code=500, detail="OpenRouter API key not configured")

  messages = [
    {"role": "system", "content": SYSTEM_PROMPT},
    {"role": "user", "content": payload.prompt},
  ]
  tool_choice = {"type": "function", "function": {"name": "searchSolutions"}} if _needs_search(payload.prompt) else "auto"

  try:
    async with httpx.AsyncClient(timeout=30) as client:
      response = await client.post(
        f"{OPENROUTER_BASE_URL}/chat/completions",
        headers={
          "Authorization": f"Bearer {OPENROUTER_API_KEY}",
          "Content-Type": "application/json",
          "X-Title": OPENROUTER_TITLE,
        },
        json={
          "model": OPENROUTER_MODEL,
          "messages": messages,
          "tools": [TOOL_DEF],
          "tool_choice": tool_choice,
          "temperature": 0.2,
        },
      )

    if response.status_code >= 400:
      print(f"OpenRouter API error: {response.status_code} {response.text}")
      raise HTTPException(status_code=502, detail=response.text)
  except Exception as e:
    print(f"Error calling OpenRouter: {e}")
    raise

  data = response.json()
  message = (data.get("choices") or [{}])[0].get("message") or {}
  tool_calls = message.get("tool_calls") or []
  first_content = message.get("content") or ""

  tool_trace: list[str] = []
  hits: list[SearchResult] = []

  if tool_calls:
    tool_messages = []
    for call in tool_calls:
      if call.get("function", {}).get("name") != "searchSolutions":
        continue
      raw_args = call.get("function", {}).get("arguments", "{}")
      try:
        args = json.loads(raw_args)
      except Exception:
        args = {}
      query = args.get("query") or payload.prompt
      limit = args.get("limit") if isinstance(args.get("limit"), int) else payload.limit

      search_response = await _search_for_user(
        db,
        scope["api_key_ids"],
        scope["allow_team"],
        scope.get("allow_admin", False),
        query,
        limit,
      )
      hits = search_response.results
      tool_trace.append(f"searchSolutions(\"{query}\") => {search_response.total} results")

      tool_payload = search_response.model_dump(mode='json') if hasattr(search_response, "model_dump") else search_response.dict()
      tool_messages.append({
        "role": "tool",
        "tool_call_id": call.get("id"),
        "content": json.dumps(tool_payload),
      })

    messages.append({
      "role": "assistant",
      "content": first_content,
      "tool_calls": tool_calls,
    })
    messages.extend(tool_messages)

    try:
      async with httpx.AsyncClient(timeout=30) as client:
        followup = await client.post(
          f"{OPENROUTER_BASE_URL}/chat/completions",
          headers={
            "Authorization": f"Bearer {OPENROUTER_API_KEY}",
            "Content-Type": "application/json",
            "X-Title": OPENROUTER_TITLE,
          },
          json={
            "model": OPENROUTER_MODEL,
            "messages": messages,
            "tool_choice": "none",
            "temperature": 0.2,
          },
        )

      if followup.status_code >= 400:
        print(f"OpenRouter followup API error: {followup.status_code} {followup.text}")
        raise HTTPException(status_code=502, detail=followup.text)
    except Exception as e:
      print(f"Error in followup OpenRouter call: {e}")
      raise

    followup_data = followup.json()
    reply = (followup_data.get("choices") or [{}])[0].get("message", {}).get("content") or ""
    return ChatResponse(reply=reply, hits=hits, toolTrace=tool_trace)

  if _needs_search(payload.prompt):
    search_response = await _search_for_user(
      db,
      scope["api_key_ids"],
      scope["allow_team"],
      scope.get("allow_admin", False),
      payload.prompt,
      payload.limit,
    )
    hits = search_response.results
    tool_trace.append(f"searchSolutions(\"{payload.prompt}\") => {search_response.total} results")

  return ChatResponse(reply=first_content or "No response generated.", hits=hits, toolTrace=tool_trace)


@app.post("/v1/chat/completions")
async def openai_chat_completions(
  payload: OpenAIChatRequest,
  db: AsyncSession = Depends(get_session),
  scope: dict = Depends(require_solution_read_scope),
):
  if not scope["user_id"]:
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
  if not payload.messages:
    raise HTTPException(status_code=422, detail="messages must not be empty")

  user_message = next((m.content for m in reversed(payload.messages) if m.role == "user"), None)
  if not user_message:
    raise HTTPException(status_code=422, detail="no user message provided")

  chat_response = await llm_chat(ChatRequest(prompt=user_message, limit=5), db, scope)
  return {
    "id": f"chatcmpl_{uuid.uuid4().hex}",
    "object": "chat.completion",
    "created": int(time.time()),
    "model": OPENROUTER_MODEL,
    "choices": [
      {
        "index": 0,
        "message": {"role": "assistant", "content": chat_response.reply},
        "finish_reason": "stop",
      }
    ],
  }


@app.get("/v1/models")
async def openai_list_models(
  scope: dict = Depends(require_solution_read_scope),
):
  if not scope["user_id"]:
    raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized")
  return {
    "object": "list",
    "data": [
      {
        "id": OPENROUTER_MODEL,
        "object": "model",
        "created": int(time.time()),
        "owned_by": "openrouter",
      }
    ],
  }
