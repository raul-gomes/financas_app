"""CategoryService: authorization via the authenticated user, one commit per request."""

from datetime import datetime

import pytest
from sqlalchemy import func, select

from app.core.errors import ConflictError, NotFoundError
from app.db.models.category import CategoryORM, SubcategoryORM
from app.db.models.transaction import TransactionORM
from app.db.repositories.category import HAS_TRANSACTIONS_MESSAGE
from app.schemas.categories import CategoriaCreate, CategoriaUpdate
from app.schemas.subcategory import SubcategoriaCreate
from app.services import category_service as module
from app.services.category_service import CategoryService


def _payload(name: str = "Food", subs: tuple[str, ...] = ("Lunch",)) -> CategoriaCreate:
    return CategoriaCreate(
        category_name=name,
        entity_type="individual",
        limit=100.0,
        type="expense",
        subcategories=[SubcategoriaCreate(subcategory_name=sub) for sub in subs],
    )


async def _count(session, model) -> int:
    return (await session.execute(select(func.count()).select_from(model))).scalar_one()


@pytest.fixture
def cache_invalidations(monkeypatch):
    """Counts cache invalidations done by the service after the commit."""
    calls: list[int] = []
    monkeypatch.setattr(module, "invalidate_opcoes_categorias_cache", lambda: calls.append(1))
    return calls


@pytest.mark.asyncio
async def test_create_flushes_only_and_rollback_leaves_nothing(
    async_session, make_uow, cache_invalidations
):
    uow, user = await make_uow(1)
    service = CategoryService(uow, user)

    created = await service.create(_payload())
    assert created.id is not None
    await uow.rollback()

    assert await _count(async_session, CategoryORM) == 0
    assert await _count(async_session, SubcategoryORM) == 0
    assert cache_invalidations == []


@pytest.mark.asyncio
async def test_commit_persists_and_invalidates_the_options_cache(
    async_session, make_uow, cache_invalidations
):
    uow, user = await make_uow(1)
    service = CategoryService(uow, user)

    await service.create(_payload())
    assert cache_invalidations == []  # nothing runs before the commit
    await uow.commit()

    assert await _count(async_session, CategoryORM) == 1
    assert cache_invalidations == [1]


@pytest.mark.asyncio
async def test_other_users_categories_are_invisible(async_session, make_uow):
    owner_uow, owner = await make_uow(1)
    created = await CategoryService(owner_uow, owner).create(_payload())
    await owner_uow.commit()
    intruder_uow, intruder = await make_uow(2)
    intruder_service = CategoryService(intruder_uow, intruder)

    for action in (
        intruder_service.get(created.id),
        intruder_service.update(created.id, CategoriaUpdate(category_name="Hijack")),
        intruder_service.delete(created.id),
    ):
        with pytest.raises(NotFoundError):
            await action

    assert await intruder_service.list() == []
    assert await _count(async_session, CategoryORM) == 1


@pytest.mark.asyncio
async def test_update_syncs_subcategories_without_committing(async_session, make_uow):
    uow, user = await make_uow(1)
    service = CategoryService(uow, user)
    category_id = (await service.create(_payload(subs=("Lunch",)))).id
    await uow.commit()
    async_session.expire_all()  # a new request starts with a fresh session
    uow, user = await make_uow(1)
    service = CategoryService(uow, user)

    updated = await service.update(
        category_id,
        CategoriaUpdate(category_name="Meals", subcategories=[{"subcategory_name": "Dinner"}]),
    )
    assert updated.name == "Meals"
    await uow.rollback()
    uow, user = await make_uow(1)  # rollback expired the loaded user

    refreshed = await CategoryService(uow, user).get(category_id)
    assert refreshed.name == "Food"
    assert [sub.name for sub in refreshed.subcategories] == ["Lunch"]


@pytest.mark.asyncio
async def test_duplicate_name_raises_conflict(make_uow):
    uow, user = await make_uow(1)
    service = CategoryService(uow, user)
    await service.create(_payload("Food"))
    await uow.commit()
    other = await service.create(_payload("Other", subs=()))

    with pytest.raises(ConflictError):
        await service.update(other.id, CategoriaUpdate(category_name="Food"))


@pytest.mark.asyncio
async def test_delete_returns_the_removed_category(async_session, make_uow):
    uow, user = await make_uow(1)
    service = CategoryService(uow, user)
    category_id = (await service.create(_payload())).id
    await uow.commit()
    async_session.expire_all()  # a new request starts with a fresh session
    uow, user = await make_uow(1)
    service = CategoryService(uow, user)

    deleted = await service.delete(category_id)
    await uow.commit()

    assert deleted.id == category_id
    assert await _count(async_session, CategoryORM) == 0
    assert await _count(async_session, SubcategoryORM) == 0


@pytest.mark.asyncio
async def test_delete_with_transactions_is_a_conflict_and_changes_nothing(async_session, make_uow):
    """Regression (Q12 b): a category that has transactions answers 409, not a crash."""
    uow, user = await make_uow(1)
    service = CategoryService(uow, user)
    category_id = (await service.create(_payload())).id
    subcategory_id = (await async_session.execute(select(SubcategoryORM.id))).scalar_one()
    async_session.add(
        TransactionORM(
            amount=10.0,
            description="Lunch",
            transaction_date=datetime(2026, 1, 10),
            type="expense",
            entity_type="individual",
            payment_method="pix",
            category_id=category_id,
            subcategory_id=subcategory_id,
            user_id=1,
        )
    )
    await uow.commit()
    async_session.expire_all()
    uow, user = await make_uow(1)
    service = CategoryService(uow, user)

    with pytest.raises(ConflictError) as raised:
        await service.delete(category_id)

    assert raised.value.message == HAS_TRANSACTIONS_MESSAGE
    assert await _count(async_session, CategoryORM) == 1
    assert await _count(async_session, SubcategoryORM) == 1
    assert await _count(async_session, TransactionORM) == 1
