"""ExtractService: statement parsing and the batch import (one commit, limits after it)."""

import pytest
from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import ValidationError
from app.db.models.category import CategoryORM
from app.db.models.transaction import TransactionORM
from app.schemas.extract import ConfirmPayload, ConfirmTransaction
from app.services import extract_service as module
from app.services.extract_service import ExtractService

LEAK_MARKER = "leak-marker-db-host-10.0.0.9"
CSV_STATEMENT = b"date,description,amount\n01/03/2026,Salary,1000.00\n02/03/2026,Coffee,-5.50\n"
OFX_STATEMENT = (
    b"<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>"
    b"<STMTTRN><DTPOSTED>20260105</DTPOSTED><TRNAMT>-10.00</TRNAMT><MEMO>Bread</MEMO></STMTTRN>"
    b"</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>"
)


def _row(description: str = "Bread", date: str = "05/01/2026", **extra) -> ConfirmTransaction:
    data = {
        "date": date,
        "description": description,
        "amount": 10.0,
        "type": "expense",
        "category_name": "Food",
        "subcategory_name": "Bakery",
    }
    return ConfirmTransaction(**(data | extra))


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


def test_parse_upload_detects_csv_by_extension_and_totals_by_type():
    response = ExtractService.parse_upload("statement.CSV", CSV_STATEMENT)

    assert (response.total, response.total_income, response.total_expenses) == (2, 1, 1)
    assert response.total_income_amount == 1000.0
    assert response.total_expenses_amount == 5.5


@pytest.mark.parametrize("filename", ["statement.ofx", "statement.qfx", "statement.bin", None])
def test_parse_upload_reads_ofx_by_extension_or_content(filename):
    response = ExtractService.parse_upload(filename, OFX_STATEMENT)

    assert [t.description for t in response.transactions] == ["Bread"]


def test_parse_upload_rejects_hostile_ofx_with_a_validation_error():
    hostile = b'<?xml version="1.0"?><!DOCTYPE x [<!ENTITY a "b">]><OFX>&a;</OFX>'

    with pytest.raises(ValidationError):
        ExtractService.parse_upload("bomb.ofx", hostile)


@pytest.mark.asyncio
async def test_confirm_flushes_only_and_rollback_leaves_nothing(
    async_session, make_uow, evaluations
):
    uow, user = await make_uow(1)

    response = await ExtractService(uow, user).confirm(ConfirmPayload(transactions=[_row()]))
    assert (response.created, response.errors) == (1, [])
    await uow.rollback()

    assert await _count(async_session, TransactionORM) == 0
    assert await _count(async_session, CategoryORM) == 0
    assert evaluations == []


@pytest.mark.asyncio
async def test_confirm_evaluates_limits_once_for_the_earliest_month_after_commit(
    async_session, make_uow, evaluations
):
    uow, user = await make_uow(1)
    payload = ConfirmPayload(
        transactions=[
            _row(date="15/03/2026"),
            _row("Old", date="20/12/2025"),
            _row("Bad", date="x"),
        ]
    )

    response = await ExtractService(uow, user).confirm(payload)

    assert response.created == 2
    assert len(response.errors) == 1  # the unparseable row is reported, not silently dropped
    assert evaluations == []
    await uow.commit()
    assert evaluations == [(1, 2025, 12)]


@pytest.mark.asyncio
async def test_confirm_with_no_rows_creates_nothing_and_evaluates_nothing(make_uow, evaluations):
    uow, user = await make_uow(1)

    response = await ExtractService(uow, user).confirm(ConfirmPayload(transactions=[]))
    await uow.commit()

    assert (response.created, response.errors) == (0, [])
    assert evaluations == []


@pytest.mark.asyncio
async def test_confirm_only_resolves_the_users_own_categories(async_session, make_uow, evaluations):
    owner_uow, owner = await make_uow(1)
    await ExtractService(owner_uow, owner).confirm(ConfirmPayload(transactions=[_row()]))
    await owner_uow.commit()
    other_uow, other = await make_uow(2)

    await ExtractService(other_uow, other).confirm(ConfirmPayload(transactions=[_row("Mine")]))
    await other_uow.commit()

    owners = (await async_session.execute(select(CategoryORM.user_id))).scalars().all()
    assert sorted(owners) == [1, 2]  # each user got their own "Food", none shared


@pytest.mark.asyncio
async def test_a_failing_batch_insert_is_reported_and_the_request_stays_usable(
    async_session, make_uow, evaluations, monkeypatch
):
    original_add_all = AsyncSession.add_all

    def failing_add_all(self, instances):
        if any(isinstance(i, TransactionORM) for i in instances):
            raise SQLAlchemyError(LEAK_MARKER)
        return original_add_all(self, instances)

    monkeypatch.setattr(AsyncSession, "add_all", failing_add_all)
    uow, user = await make_uow(1)

    response = await ExtractService(uow, user).confirm(ConfirmPayload(transactions=[_row()]))
    await uow.commit()  # the session is not poisoned: the commit still works

    assert response.created == 0
    assert response.errors == ["Erro no commit em lote"]
    assert LEAK_MARKER not in str(response.model_dump())
    assert await _count(async_session, TransactionORM) == 0
