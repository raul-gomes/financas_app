"""Demo seed: valid payment methods, no duplicated recurring bills, data up to today."""

from collections import Counter
from datetime import date, datetime

import pytest
from sqlalchemy import select

from app.db.models import RecurringAccountORM, TransactionORM
from app.schemas.transaction import TipoPagamento
from app.scripts.seed import DEMO_HISTORY_MONTHS, build_demo_data, demo_months

TODAY = date(2026, 11, 15)
CURRENT_MONTH_START = datetime(2026, 11, 1)


async def _seed(session) -> int:
    """Seed the demo data for TODAY into the test session; returns the user id."""
    await session.run_sync(lambda db: build_demo_data(db, TODAY, "demo@example.com", "Demo"))
    return (await session.execute(select(TransactionORM.user_id).limit(1))).scalar_one()


async def _transactions(session) -> list[TransactionORM]:
    return list((await session.execute(select(TransactionORM))).unique().scalars().all())


def test_demo_months_end_at_the_current_month():
    months = demo_months(TODAY)
    assert len(months) == DEMO_HISTORY_MONTHS
    assert months[-1] == (2026, 11)
    assert months[0] == (2025, 6)


def test_demo_months_cross_the_year_backwards():
    assert demo_months(date(2026, 2, 10), 3) == [(2025, 12), (2026, 1), (2026, 2)]


@pytest.mark.asyncio
async def test_every_payment_method_is_one_the_app_stores(async_session):
    await _seed(async_session)
    allowed = {method.value for method in TipoPagamento}
    used = {txn.payment_method for txn in await _transactions(async_session)}
    assert used <= allowed


@pytest.mark.asyncio
async def test_recurring_bills_share_their_account_group_once_a_month(async_session):
    await _seed(async_session)
    accounts = {
        acc.id: acc
        for acc in (await async_session.execute(select(RecurringAccountORM)))
        .unique()
        .scalars()
        .all()
    }
    bills = [txn for txn in await _transactions(async_session) if txn.recurring_account_id]

    assert all(txn.group_id == accounts[txn.recurring_account_id].group_id for txn in bills)
    per_month = Counter(
        (txn.recurring_account_id, txn.transaction_date.year, txn.transaction_date.month)
        for txn in bills
    )
    assert set(per_month.values()) == {1}
    for account in accounts.values():
        months_billed = sorted((y, m) for acc_id, y, m in per_month if acc_id == account.id)
        start = (account.start_date.year, account.start_date.month)
        # Like the app: every installment exists from the start, future ones included
        assert len(months_billed) == account.total_installments
        assert months_billed[0] == start


@pytest.mark.asyncio
async def test_recurring_accounts_are_at_different_installments(async_session):
    await _seed(async_session)
    bills = [txn for txn in await _transactions(async_session) if txn.recurring_account_id]
    remaining = Counter(
        txn.recurring_account_id for txn in bills if txn.transaction_date >= CURRENT_MONTH_START
    )
    ending_soon = [count for count in remaining.values() if count <= 2]
    assert len(set(remaining.values())) > 1
    assert len(ending_soon) < len(remaining) / 2


@pytest.mark.asyncio
async def test_one_off_entries_of_the_current_month_stop_at_today(async_session):
    await _seed(async_session)
    one_off = [
        txn
        for txn in await _transactions(async_session)
        if txn.recurring_account_id is None and not txn.is_installment
    ]
    assert max(txn.transaction_date.date() for txn in one_off) <= TODAY


@pytest.mark.asyncio
async def test_every_month_has_investments_for_the_yearly_chart(async_session):
    await _seed(async_session)
    invested_months = {
        (txn.transaction_date.year, txn.transaction_date.month)
        for txn in await _transactions(async_session)
        if txn.type == "investment"
    }
    assert invested_months == set(demo_months(TODAY))


@pytest.mark.asyncio
async def test_the_demo_couple_ends_the_current_month_positive(async_session):
    await _seed(async_session)
    current = [
        txn
        for txn in await _transactions(async_session)
        if (txn.transaction_date.year, txn.transaction_date.month) == (2026, 11)
    ]
    income = sum(txn.amount for txn in current if txn.type == "income")
    outflow = sum(txn.amount for txn in current if txn.type in ("expense", "investment"))
    assert income > outflow


@pytest.mark.asyncio
async def test_the_seed_is_deterministic_for_a_given_day(async_session):
    await _seed(async_session)
    first = sorted(
        (txn.description, txn.amount, txn.transaction_date)
        for txn in await _transactions(async_session)
    )
    for txn in await _transactions(async_session):
        await async_session.delete(txn)
    await async_session.flush()

    await async_session.run_sync(lambda db: build_demo_data(db, TODAY, "demo2@example.com", "Demo"))
    second = sorted(
        (txn.description, txn.amount, txn.transaction_date)
        for txn in await _transactions(async_session)
    )
    assert first == second
