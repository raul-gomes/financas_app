"""RecurringAccountService: authorization via the authenticated user, one commit per request."""

from datetime import UTC, datetime

import pytest
import time_machine
from sqlalchemy import event, func, select

from app.core.errors import NotFoundError, UnprocessableError
from app.db.models.category import CategoryORM, SubcategoryORM
from app.db.models.recurring_account import RecurringAccountORM
from app.db.models.transaction import TransactionORM
from app.db.repositories.recurring_account import ContaRecorrenteRepository
from app.schemas.recurring_account import (
    ContaRecorrenteCreate,
    ContaRecorrenteUpdate,
)
from app.services import recurring_account_service as module
from app.services.recurring_account_service import RecurringAccountService

NOW = datetime(2026, 3, 15, 12, 0, tzinfo=UTC)


def _payload(**overrides) -> ContaRecorrenteCreate:
    data = {
        "description": "Rent",
        "amount": 1500.0,
        "due_day": 10,
        "category_name": "Housing",
        "subcategory_name": "Rent",
        "entity_type": "individual",
        "payment_method": "pix",
        "start_date": "2026-03-01T00:00:00",
        "total_installments": 3,
    }
    return ContaRecorrenteCreate(**(data | overrides))


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


@pytest.mark.asyncio
async def test_create_resolves_names_and_rollback_leaves_nothing(async_session, make_uow):
    uow, user = await make_uow(1)
    service = RecurringAccountService(uow, user)

    account = await service.create(_payload())
    assert account.category_id is not None
    assert account.subcategory_id is not None
    assert await _count(async_session, TransactionORM) == 3
    await uow.rollback()

    assert await _count(async_session, RecurringAccountORM) == 0
    assert await _count(async_session, TransactionORM) == 0
    assert await _count(async_session, CategoryORM) == 0
    assert await _count(async_session, SubcategoryORM) == 0


@pytest.mark.asyncio
async def test_create_reuses_an_existing_category_by_name(async_session, make_uow):
    uow, user = await make_uow(1)
    service = RecurringAccountService(uow, user)
    first = await service.create(_payload())
    second = await service.create(_payload(description="Rent 2"))

    assert second.category_id == first.category_id
    assert second.subcategory_id == first.subcategory_id
    assert await _count(async_session, CategoryORM) == 1


@pytest.mark.asyncio
async def test_missing_category_or_subcategory_is_unprocessable(make_uow):
    uow, user = await make_uow(1)
    service = RecurringAccountService(uow, user)
    update = ContaRecorrenteUpdate(subcategory_name="Only sub")

    with pytest.raises(UnprocessableError):
        await service.update(1, update)


@pytest.mark.asyncio
async def test_other_users_accounts_are_invisible(async_session, make_uow):
    owner_uow, owner = await make_uow(1)
    account_id = (await RecurringAccountService(owner_uow, owner).create(_payload())).id
    await owner_uow.commit()
    intruder_uow, intruder = await make_uow(2)
    service = RecurringAccountService(intruder_uow, intruder)

    for action in (
        service.get(account_id),
        service.update(account_id, ContaRecorrenteUpdate(description="hijack")),
        service.delete(account_id),
        service.renew(account_id),
    ):
        with pytest.raises(NotFoundError):
            await action

    assert await service.list_accounts(None, 100, 0) == []
    assert await _count(async_session, RecurringAccountORM) == 1
    assert await _count(async_session, TransactionORM) == 3


@pytest.mark.asyncio
async def test_deactivating_cancels_future_transactions_and_delete_removes_all(
    async_session, make_uow
):
    uow, user = await make_uow(1)
    service = RecurringAccountService(uow, user)
    account_id = (await service.create(_payload())).id

    with time_machine.travel(NOW, tick=False):
        updated = await service.update(account_id, ContaRecorrenteUpdate(active=False))
    assert updated.active is False
    assert await _count(async_session, TransactionORM) == 0  # all 3 are from March onwards

    await service.delete(account_id)
    await uow.commit()
    assert await _count(async_session, RecurringAccountORM) == 0


@pytest.mark.asyncio
async def test_installments_use_one_portable_bulk_insert_and_skip_existing_months(
    async_session, make_uow
):
    """Q12 e: no Postgres-only SQL; months that already have a transaction are skipped."""
    uow, user = await make_uow(1)
    account = await RecurringAccountService(uow, user).create(_payload(total_installments=4))
    repo = ContaRecorrenteRepository(uow.session)
    rows = (
        (
            await async_session.execute(
                select(TransactionORM)
                .where(TransactionORM.recurring_account_id == account.id)
                .order_by(TransactionORM.transaction_date)
            )
        )
        .unique()
        .scalars()
    )
    await async_session.delete(next(iter(rows)))
    await async_session.flush()

    statements: list[str] = []

    def _capture(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    sync_engine = async_session.bind.sync_engine
    event.listen(sync_engine, "before_cursor_execute", _capture)
    try:
        created = await repo._generate_installments(account, user.id)
    finally:
        event.remove(sync_engine, "before_cursor_execute", _capture)

    assert created == 1
    assert await _count(async_session, TransactionORM) == 4
    inserts = [s for s in statements if s.lstrip().upper().startswith("INSERT INTO TRANSACOES")]
    assert len(inserts) == 1
    assert not any("UNNEST" in s.upper() or "ON CONFLICT" in s.upper() for s in statements)
    assert await repo._generate_installments(account, user.id) == 0
