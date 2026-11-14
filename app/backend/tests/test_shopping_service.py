"""ShoppingService: authorization via the authenticated user, one commit per request."""

from datetime import UTC, date, datetime

import pytest
import time_machine
from sqlalchemy import func, select

from app.core.errors import NotFoundError
from app.db.models.shopping_item import ShoppingItemORM
from app.schemas.shopping import ShoppingItemCreate, ShoppingItemUpdate
from app.services.shopping_service import ShoppingService

MONTH = date(2026, 3, 1)


def _item(name: str = "Rice", month: date = MONTH) -> ShoppingItemCreate:
    return ShoppingItemCreate(name=name, reference_month=month)


async def _count(session) -> int:
    return (await session.execute(select(func.count()).select_from(ShoppingItemORM))).scalar_one()


@pytest.mark.asyncio
async def test_create_flushes_only_and_rollback_leaves_nothing(async_session, make_uow):
    uow, user = await make_uow(1)
    service = ShoppingService(uow, user)

    created = await service.create(_item())
    assert created.id is not None
    await uow.rollback()

    assert await _count(async_session) == 0


@pytest.mark.asyncio
async def test_commit_persists_the_item(async_session, make_uow):
    uow, user = await make_uow(1)
    await ShoppingService(uow, user).create(_item())
    await uow.commit()

    assert await _count(async_session) == 1


@pytest.mark.asyncio
async def test_other_users_items_are_invisible(async_session, make_uow):
    owner_uow, owner = await make_uow(1)
    item_id = (await ShoppingService(owner_uow, owner).create(_item())).id
    await owner_uow.commit()
    intruder_uow, intruder = await make_uow(2)
    service = ShoppingService(intruder_uow, intruder)

    for action in (service.update(item_id, ShoppingItemUpdate(name="x")), service.delete(item_id)):
        with pytest.raises(NotFoundError):
            await action

    assert await service.list_month(MONTH, None) == []
    assert await _count(async_session) == 1


@pytest.mark.asyncio
async def test_checking_an_item_stamps_the_completion_date(make_uow):
    uow, user = await make_uow(1)
    service = ShoppingService(uow, user)
    item_id = (await service.create(_item())).id

    with time_machine.travel(datetime(2026, 3, 15, 12, 0, tzinfo=UTC), tick=False):
        checked = await service.update(item_id, ShoppingItemUpdate(checked=True))
    assert (checked.checked, checked.completed_at) == (True, date(2026, 3, 15))

    unchecked = await service.update(item_id, ShoppingItemUpdate(checked=False))
    assert (unchecked.checked, unchecked.completed_at) == (False, None)


@pytest.mark.asyncio
async def test_list_month_rolls_unchecked_items_over_and_is_user_scoped(make_uow):
    uow, user = await make_uow(1)
    service = ShoppingService(uow, user)
    await service.create(_item("Old unchecked", date(2026, 2, 1)))
    done_id = (await service.create(_item("Old checked", date(2026, 2, 1)))).id
    await service.update(done_id, ShoppingItemUpdate(checked=True))
    await service.create(_item("Current"))

    names = [item.name for item in await service.list_month(MONTH, None)]

    assert sorted(names) == ["Current", "Old unchecked"]


@pytest.mark.asyncio
async def test_delete_returns_the_removed_item(async_session, make_uow):
    uow, user = await make_uow(1)
    service = ShoppingService(uow, user)
    item_id = (await service.create(_item())).id

    deleted = await service.delete(item_id)
    await uow.commit()

    assert deleted.id == item_id
    assert await _count(async_session) == 0
