"""GoalService: authorization via the authenticated user, one commit per request."""

from datetime import UTC, date, datetime

import pytest
import time_machine
from sqlalchemy import func, select

from app.core.errors import ConflictError, NotFoundError
from app.db.models.category import CategoryORM, SubcategoryORM
from app.schemas.goals import MetaCreate, MetaUpdate
from app.services.goal_service import GoalService

TODAY = date(2026, 3, 15)


def _goal(name: str = "Trip", target: float = 1000.0) -> MetaCreate:
    return MetaCreate(subcategory_name=name, target_amount=target)


async def _count(session, model) -> int:
    return (await session.execute(select(func.count()).select_from(model))).scalar_one()


@pytest.mark.asyncio
async def test_create_flushes_only_and_rollback_leaves_nothing(async_session, make_uow):
    uow, user = await make_uow(1)
    service = GoalService(uow, user)

    created = await service.create(_goal())
    assert created.id is not None
    await uow.rollback()

    assert await _count(async_session, SubcategoryORM) == 0
    assert await _count(async_session, CategoryORM) == 0  # the "Metas" category rolls back too


@pytest.mark.asyncio
async def test_commit_persists_and_duplicate_name_conflicts(async_session, make_uow):
    uow, user = await make_uow(1)
    service = GoalService(uow, user)
    await service.create(_goal("Trip"))
    await uow.commit()

    with pytest.raises(ConflictError):
        await service.create(_goal("Trip"))

    assert await _count(async_session, SubcategoryORM) == 1


@pytest.mark.asyncio
async def test_other_users_goals_are_invisible(async_session, make_uow):
    owner_uow, owner = await make_uow(1)
    goal_id = (await GoalService(owner_uow, owner).create(_goal())).id
    await owner_uow.commit()
    intruder_uow, intruder = await make_uow(2)
    service = GoalService(intruder_uow, intruder)

    for action in (
        service.update(goal_id, MetaUpdate(target_amount=1.0)),
        service.delete(goal_id),
        service.complete(goal_id),
        service.reactivate(goal_id),
    ):
        with pytest.raises(NotFoundError):
            await action

    assert await service.list_goals(None, None, 100, 0) == []
    assert await service.progress(2026, 3, None, None) == []
    assert await _count(async_session, SubcategoryORM) == 1


@pytest.mark.asyncio
async def test_complete_and_reactivate_toggle_the_goal(make_uow):
    uow, user = await make_uow(1)
    service = GoalService(uow, user)
    goal_id = (await service.create(_goal())).id

    with time_machine.travel(datetime(2026, 3, 15, 12, 0, tzinfo=UTC), tick=False):
        completed = await service.complete(goal_id)
    assert (completed.completed, completed.completed_at) == (True, TODAY)
    assert [g.id for g in await service.list_goals(True, None, 100, 0)] == [goal_id]
    assert await service.list_goals(False, None, 100, 0) == []

    reactivated = await service.reactivate(goal_id)
    assert (reactivated.completed, reactivated.completed_at) == (False, None)


@pytest.mark.asyncio
async def test_update_and_delete_return_the_goal(async_session, make_uow):
    uow, user = await make_uow(1)
    service = GoalService(uow, user)
    goal_id = (await service.create(_goal())).id

    updated = await service.update(goal_id, MetaUpdate(subcategory_name="Journey"))
    deleted = await service.delete(goal_id)
    await uow.commit()

    assert updated.name == "Journey"
    assert deleted.id == goal_id
    assert await _count(async_session, SubcategoryORM) == 0
