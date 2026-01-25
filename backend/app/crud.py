import uuid
from typing import List
from sqlalchemy import select, or_, and_, func, cast, Text, delete, update
from sqlalchemy.ext.asyncio import AsyncSession
from .models import Solution, SolutionVote
from .schemas import SolutionCreate
from .visibility import VISIBILITY_PRIVATE, VISIBILITY_TEAM


def generate_id() -> str:
    return uuid.uuid4().hex


async def create_solution(
    db: AsyncSession,
    data: SolutionCreate,
    api_key_id: str,
    user_id: str,
    visibility: str,
) -> Solution:
    obj = Solution(
      id=generate_id(),
      user_id=user_id,
      api_key_id=api_key_id,
      title=data.title,
      error_message=data.errorMessage,
      error_type=data.errorType,
      context=data.context,
      root_cause=data.rootCause,
      solution=data.solution,
      code_changes=data.codeChanges,
      tags=data.tags,
      conversation_language=data.conversationLanguage,
      programming_language=data.programmingLanguage,
      vibecoding_software=data.vibecodingSoftware,
      project_path=data.projectPath,
      environment=data.environment,
      embedding=data.embedding,
      embedding_status="pending",
      visibility=visibility,
    )
    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return obj


async def get_solution(
    db: AsyncSession,
    solution_id: str,
    api_key_ids: list[str],
    allow_team: bool,
) -> Solution | None:
    access_conditions = _access_conditions(api_key_ids, allow_team)
    if not access_conditions:
        return None
    res = await db.execute(
        select(Solution).where(Solution.id == solution_id, or_(*access_conditions))
    )
    return res.scalar_one_or_none()


def _access_conditions(api_key_ids: list[str], allow_team: bool) -> list:
    conditions = []
    if api_key_ids:
        conditions.append(
            and_(
                Solution.api_key_id.in_(api_key_ids),
                Solution.visibility == VISIBILITY_PRIVATE,
            )
        )
    if allow_team:
        conditions.append(Solution.visibility == VISIBILITY_TEAM)
    return conditions


def _visibility_condition(
    visibility: str | None,
    api_key_ids: list[str],
    allow_team: bool,
):
    if visibility == VISIBILITY_TEAM:
        return Solution.visibility == VISIBILITY_TEAM if allow_team else None
    if visibility == VISIBILITY_PRIVATE:
        if not api_key_ids:
            return None
        return and_(
            Solution.visibility == VISIBILITY_PRIVATE,
            Solution.api_key_id.in_(api_key_ids),
        )
    access_conditions = _access_conditions(api_key_ids, allow_team)
    if not access_conditions:
        return None
    return or_(*access_conditions)


async def list_solutions(
    db: AsyncSession,
    api_key_ids: list[str],
    allow_team: bool,
    limit: int = 25,
    offset: int = 0,
    visibility: str | None = None,
) -> tuple[int, List[Solution]]:
    access_condition = _visibility_condition(visibility, api_key_ids, allow_team)
    if access_condition is None:
        return 0, []
    base = select(Solution).where(access_condition)
    total_res = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_res.scalar() or 0

    res = await db.execute(base.order_by(Solution.created_at.desc()).limit(limit).offset(offset))
    return total, res.scalars().all()


async def count_accessible_solutions(
    db: AsyncSession,
    api_key_ids: list[str],
    allow_team: bool,
    visibility: str | None = None,
) -> int:
    access_condition = _visibility_condition(visibility, api_key_ids, allow_team)
    if access_condition is None:
        return 0
    count_stmt = select(func.count()).select_from(
        select(Solution.id).where(access_condition).subquery()
    )
    res = await db.execute(count_stmt)
    return res.scalar() or 0


async def delete_solution(db: AsyncSession, solution_id: str, api_key_ids: list[str]) -> bool:
    if not api_key_ids:
        return False
    res = await db.execute(select(Solution).where(Solution.id == solution_id, Solution.api_key_id.in_(api_key_ids)))
    sol = res.scalar_one_or_none()
    if not sol:
        return False
    await db.execute(delete(SolutionVote).where(SolutionVote.solution_id == sol.id))
    await db.delete(sol)
    await db.commit()
    return True


async def bump_upvotes(
    db: AsyncSession,
    solution_ids: list[str],
    api_key_ids: list[str],
    allow_team: bool,
) -> int:
    if not solution_ids:
        return 0
    access_conditions = _access_conditions(api_key_ids, allow_team)
    if not access_conditions:
        return 0

    stmt = (
        update(Solution)
        .where(Solution.id.in_(solution_ids), or_(*access_conditions))
        .values(upvotes=Solution.upvotes + 1)
    )
    res = await db.execute(stmt)
    await db.commit()
    return res.rowcount or 0


async def update_solution_visibility(
    db: AsyncSession,
    solution_id: str,
    api_key_ids: list[str],
    visibility: str,
) -> Solution | None:
    if not api_key_ids:
        return None
    res = await db.execute(
        select(Solution).where(Solution.id == solution_id, Solution.api_key_id.in_(api_key_ids))
    )
    sol = res.scalar_one_or_none()
    if not sol:
        return None
    sol.visibility = visibility
    await db.commit()
    await db.refresh(sol)
    return sol

async def search_solutions(
    db: AsyncSession,
    query: str,
    api_key_ids: list[str],
    allow_team: bool,
    limit: int = 25,
    offset: int = 0,
    visibility: str | None = None,
) -> tuple[int, List[Solution]]:
    pattern = f"%{query}%"
    access_condition = _visibility_condition(visibility, api_key_ids, allow_team)
    if access_condition is None:
        return 0, []
    base = select(Solution).where(
        access_condition,
        or_(
            Solution.title.ilike(pattern),
            Solution.error_message.ilike(pattern),
            Solution.context.ilike(pattern),
            Solution.root_cause.ilike(pattern),
            Solution.solution.ilike(pattern),
            cast(Solution.tags, Text).ilike(pattern),
        ),
    )
    total_res = await db.execute(select(func.count()).select_from(base.subquery()))
    total = total_res.scalar() or 0

    res = await db.execute(base.order_by(Solution.created_at.desc()).limit(limit).offset(offset))
    return total, res.scalars().all()


async def get_solution_vote(db: AsyncSession, solution_id: str, user_id: str) -> int | None:
    res = await db.execute(
        select(SolutionVote.value).where(SolutionVote.solution_id == solution_id, SolutionVote.user_id == user_id)
    )
    return res.scalar_one_or_none()


async def set_solution_vote(
    db: AsyncSession,
    solution: Solution,
    user_id: str,
    value: int,
) -> int | None:
    if value not in (-1, 1):
        raise ValueError("vote value must be -1 or 1")

    if str(solution.user_id) == str(user_id):
        raise ValueError("cannot vote on your own solution")

    existing_res = await db.execute(
        select(SolutionVote).where(SolutionVote.solution_id == solution.id, SolutionVote.user_id == user_id)
    )
    existing = existing_res.scalar_one_or_none()

    upvotes = int(solution.upvotes or 0)
    downvotes = int(solution.downvotes or 0)

    if not existing:
        db.add(SolutionVote(id=generate_id(), solution_id=solution.id, user_id=user_id, value=value))
        if value == 1:
            upvotes += 1
        else:
            downvotes += 1
        solution.upvotes = upvotes
        solution.downvotes = downvotes
        await db.commit()
        return value

    if existing.value == value:
        return existing.value

    if existing.value == 1:
        upvotes -= 1
    else:
        downvotes -= 1

    existing.value = value
    if value == 1:
        upvotes += 1
    else:
        downvotes += 1

    solution.upvotes = upvotes
    solution.downvotes = downvotes
    await db.commit()
    return value


async def clear_solution_vote(db: AsyncSession, solution: Solution, user_id: str) -> int | None:
    existing_res = await db.execute(
        select(SolutionVote).where(SolutionVote.solution_id == solution.id, SolutionVote.user_id == user_id)
    )
    existing = existing_res.scalar_one_or_none()
    if not existing:
        return None

    upvotes = int(solution.upvotes or 0)
    downvotes = int(solution.downvotes or 0)
    if existing.value == 1:
        upvotes -= 1
    else:
        downvotes -= 1

    await db.execute(delete(SolutionVote).where(SolutionVote.id == existing.id))
    solution.upvotes = upvotes
    solution.downvotes = downvotes
    await db.commit()
    return None
