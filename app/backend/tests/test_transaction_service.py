"""TransactionService: authorization via the authenticated user, one commit per request."""

from datetime import datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import func, select

from app.core.unit_of_work import UnitOfWork
from app.db.models.category import CategoryORM
from app.db.models.transaction import TransactionORM
from app.db.models.user import UserORM
from app.schemas.transaction import (
    DuplicateResolution,
    ResolveDuplicatesRequest,
    TransacaoCreate,
    TransacaoUpdate,
)
from app.services import transaction_service as module
from app.services.transaction_service import TransactionService


def _payload(description: str = "Lunch", date: str = "2026-03-10T10:00:00") -> TransacaoCreate:
    return TransacaoCreate(
        amount=25.0,
        description=description,
        transaction_date=datetime.fromisoformat(date),
        type="expense",
        entity_type="individual",
        payment_method="pix",
        category_name="Food",
        subcategory_name="Restaurant",
    )


async def _count(session, model) -> int:
    return (await session.execute(select(func.count()).select_from(model))).scalar_one()


@pytest.fixture
def evaluations(monkeypatch):
    """Replaces the limit evaluation with a recorder (the real one has its own tests)."""
    calls: list[tuple[int, int, int]] = []

    async def fake(session, user_id, year=None, month=None):
        calls.append((user_id, year, month))
        return []

    monkeypatch.setattr(module, "trigger_limit_evaluation", fake)
    return calls


async def _service(session, user_id: int) -> tuple[TransactionService, UnitOfWork]:
    if await session.get(UserORM, user_id) is None:
        session.add(
            UserORM(id=user_id, name="U", email=f"u{user_id}@example.com", password_hash="")
        )
        await session.commit()
    user = await session.get(UserORM, user_id)
    uow = UnitOfWork(session)
    return TransactionService(uow, user), uow


@pytest.mark.asyncio
async def test_create_does_not_commit_and_rollback_leaves_nothing_behind(
    async_session, evaluations
):
    service, uow = await _service(async_session, 1)

    created = await service.create(_payload())
    assert created.id is not None
    await uow.rollback()

    assert await _count(async_session, TransactionORM) == 0
    # The auto-created category/subcategory are part of the same transaction.
    assert await _count(async_session, CategoryORM) == 0
    assert evaluations == []


@pytest.mark.asyncio
async def test_commit_persists_and_evaluates_limits_for_the_transaction_month(
    async_session, evaluations
):
    service, uow = await _service(async_session, 1)

    await service.create(_payload(date="2026-03-10T10:00:00"))
    assert evaluations == []  # nothing runs before the commit
    await uow.commit()

    assert await _count(async_session, TransactionORM) == 1
    assert evaluations == [(1, 2026, 3)]


@pytest.mark.asyncio
async def test_a_failing_limit_evaluation_does_not_undo_the_write(async_session, monkeypatch):
    async def boom(*args, **kwargs):
        raise RuntimeError("email provider down")

    monkeypatch.setattr(module, "trigger_limit_evaluation", boom)
    service, uow = await _service(async_session, 1)

    await service.create(_payload())
    await uow.commit()

    assert await _count(async_session, TransactionORM) == 1


@pytest.mark.asyncio
async def test_other_users_transactions_are_invisible(async_session, evaluations):
    owner, owner_uow = await _service(async_session, 1)
    created = await owner.create(_payload())
    await owner_uow.commit()
    intruder, _ = await _service(async_session, 2)

    for action in (
        intruder.get(created.id),
        intruder.update(created.id, TransacaoUpdate(description="hijack")),
        intruder.delete(created.id),
    ):
        with pytest.raises(HTTPException) as exc:
            await action
        assert exc.value.status_code == 404

    assert await _count(async_session, TransactionORM) == 1


@pytest.mark.asyncio
async def test_resolve_duplicates_never_deletes_other_users_rows(async_session, evaluations):
    owner, owner_uow = await _service(async_session, 1)
    mine = await owner.create(_payload("mine"))
    await owner_uow.commit()
    intruder, intruder_uow = await _service(async_session, 2)
    own = await intruder.create(_payload("own"))
    await intruder_uow.commit()

    result = await intruder.resolve_duplicates(
        ResolveDuplicatesRequest(
            resolutions=[DuplicateResolution(new_id=own.id, existing_id=mine.id, action="keep_new")]
        )
    )
    await intruder_uow.commit()

    assert result.resolved == 1
    assert result.deleted == 0  # the other user's row was not found, so nothing was removed
    remaining = (await async_session.execute(select(TransactionORM.description))).scalars().all()
    assert sorted(remaining) == ["mine", "own"]


@pytest.mark.asyncio
async def test_list_page_rejects_a_malformed_cursor(async_session, evaluations):
    from app.db.repositories.transaction import TransactionFilters

    service, _ = await _service(async_session, 1)

    with pytest.raises(HTTPException) as exc:
        await service.list_page(TransactionFilters(), 10, "###")

    assert exc.value.status_code == 400
