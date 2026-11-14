"""SQL aggregations of the dashboard/overview match a naive in-Python reference.

The reference functions below are the original row-loading implementations (sum over the
ORM rows). The repositories now aggregate in SQL; on the same seeded data both must agree,
for every PF/PJ scope and without leaking the other user's rows.
"""

from collections import defaultdict
from datetime import date, datetime

import pytest
import pytest_asyncio
from sqlalchemy import event, select

from app.db.models.category import CategoryORM, SubcategoryORM
from app.db.models.recurring_account import RecurringAccountORM
from app.db.models.transaction import TransactionORM
from app.db.models.user import UserORM
from app.db.repositories.dashboard import DashboardRepository
from app.db.repositories.overview import DashboardOverviewRepository
from app.schemas.dashboard import TipoTrans

USER = 1
OTHER_USER = 2
YEAR, MONTH = 2026, 5
MONTH_START = datetime(YEAR, MONTH, 1)
MONTH_END = datetime(YEAR, MONTH + 1, 1)
TODAY = date(2026, 5, 20)
SCOPES = ["all", "individual", "business"]


def _tx(user, cat, sub, amount, kind, day, entity="individual", method="pix", **extra):
    return TransactionORM(
        user_id=user,
        category_id=cat.id,
        subcategory_id=sub.id,
        amount=amount,
        type=kind,
        description=f"{kind} {amount}",
        transaction_date=datetime(YEAR, MONTH, day, 10, 0),
        entity_type=entity,
        payment_method=method,
        **extra,
    )


@pytest_asyncio.fixture
async def seeded(async_session):
    """Two users; user 1 has PF/PJ categories, mixed types, a recurring tx and installments."""
    s = async_session
    s.add_all(
        [
            UserORM(id=USER, name="U1", email="u1@example.com", password_hash=""),
            UserORM(id=OTHER_USER, name="U2", email="u2@example.com", password_hash=""),
        ]
    )
    await s.flush()

    def cat(user, name, entity, limit, subs):
        c = CategoryORM(user_id=user, name=name, entity_type=entity, limit=limit)
        c.subcategories = [SubcategoryORM(name=n) for n in subs]
        s.add(c)
        return c

    food = cat(USER, "Food", "individual", 500.0, ["Market", "Bakery"])
    fun = cat(USER, "Fun", "individual", 100.0, ["Cinema"])
    work = cat(USER, "Work", "individual", 0.0, ["Salary"])
    pj_ops = cat(USER, "Ops", "business", 1000.0, ["Tools"])
    cat(USER, "Limite Cartao Credito", "individual", 2000.0, ["Card"])
    cat(USER, "Mensal PF", "individual", 3000.0, ["Goal"])
    cat(USER, "Mensal PJ", "business", 5000.0, ["Goal"])
    other = cat(OTHER_USER, "Food", "individual", 10.0, ["Market"])
    await s.flush()

    recurring = RecurringAccountORM(
        user_id=USER,
        description="Rent",
        amount=900.0,
        due_day=5,
        category_id=food.id,
        subcategory_id=food.subcategories[0].id,
        entity_type="individual",
        payment_method="pix",
        start_date=datetime(2026, 1, 1),
        total_installments=12,
    )
    s.add(recurring)
    await s.flush()

    market, bakery = food.subcategories
    s.add_all(
        [
            _tx(USER, work, work.subcategories[0], 4000.10, "income", 1),
            _tx(USER, work, work.subcategories[0], 150.25, "income", 15, entity="business"),
            _tx(USER, food, market, 120.10, "expense", 2),
            _tx(USER, food, market, 80.20, "expense", 25),
            _tx(USER, food, bakery, 410.05, "expense", 3, method="credit"),
            _tx(USER, fun, fun.subcategories[0], 99.99, "expense", 4, method="credit"),
            _tx(USER, pj_ops, pj_ops.subcategories[0], 300.0, "expense", 5, entity="business"),
            _tx(USER, pj_ops, pj_ops.subcategories[0], 50.5, "investment", 6, entity="business"),
            _tx(USER, food, market, 200.0, "investment", 7),
            _tx(
                USER,
                food,
                market,
                900.0,
                "expense",
                8,
                recurring_account_id=recurring.id,
            ),
            _tx(
                USER,
                fun,
                fun.subcategories[0],
                33.33,
                "expense",
                9,
                is_installment=True,
                installment_number=1,
                total_installments=3,
                method="credit",
            ),
            # Outside the month: must not count
            TransactionORM(
                user_id=USER,
                category_id=food.id,
                subcategory_id=market.id,
                amount=777.0,
                type="expense",
                description="april",
                transaction_date=datetime(YEAR, MONTH - 1, 28, 10, 0),
                entity_type="individual",
                payment_method="pix",
            ),
            # Another user's data: must never leak
            _tx(OTHER_USER, other, other.subcategories[0], 9999.0, "expense", 10),
            _tx(OTHER_USER, other, other.subcategories[0], 8888.0, "income", 11),
        ]
    )
    await s.commit()
    return s


async def _user_rows(session, user_id=USER) -> list[TransactionORM]:
    result = await session.execute(select(TransactionORM).where(TransactionORM.user_id == user_id))
    return list(result.unique().scalars().all())


def _in_scope(rows, scope, start=MONTH_START, end=MONTH_END):
    return [
        t
        for t in rows
        if start <= t.transaction_date < end and (scope == "all" or t.entity_type == scope)
    ]


def _sum(rows, **conds):
    return sum(
        t.amount for t in rows if all(getattr(t, key) == value for key, value in conds.items())
    )


@pytest.mark.asyncio
@pytest.mark.parametrize("scope", SCOPES)
async def test_overview_totals_progress_and_credit_card_match_reference(seeded, scope):
    rows = _in_scope(await _user_rows(seeded), scope)
    repo = DashboardOverviewRepository(seeded)

    overview = await repo.overview_geral(YEAR, MONTH, scope, USER, is_admin=False, today=TODAY)

    income = _sum(rows, type="income")
    expense = _sum(rows, type="expense")
    assert overview.totals.total_income == pytest.approx(round(income, 2))
    assert overview.totals.total_expenses == pytest.approx(round(expense, 2))
    assert overview.totals.total_invested == pytest.approx(round(_sum(rows, type="investment"), 2))
    assert overview.totals.balance == pytest.approx(round(income - expense, 2))

    upto = [t for t in rows if t.transaction_date <= datetime(YEAR, MONTH, TODAY.day, 23, 59, 59)]
    progress = overview.month_progress
    assert progress.day == TODAY.day
    assert progress.days_in_month == 31
    assert progress.income_up_to_today == pytest.approx(round(_sum(upto, type="income"), 2))
    assert progress.expenses_up_to_today == pytest.approx(round(_sum(upto, type="expense"), 2))
    assert progress.balance == pytest.approx(
        round(_sum(upto, type="income") - _sum(upto, type="expense"), 2)
    )

    used = _sum(rows, type="expense", payment_method="credit")
    limit = 2000.0 if scope in ("all", "individual") else 0.0
    assert overview.credit_card.limit == pytest.approx(limit)
    assert overview.credit_card.used == pytest.approx(round(used, 2))
    assert overview.credit_card.percent_used == pytest.approx(
        round(used / limit * 100, 1) if limit else 0.0
    )


@pytest.mark.asyncio
async def test_overview_past_month_uses_the_whole_month_for_progress(seeded):
    repo = DashboardOverviewRepository(seeded)

    overview = await repo.overview_geral(
        YEAR, MONTH, "all", USER, is_admin=False, today=date(2026, 6, 2)
    )

    assert overview.month_progress.day == 31
    assert overview.month_progress.income_up_to_today == pytest.approx(overview.totals.total_income)


@pytest.mark.asyncio
async def test_overview_installments_match_the_installment_rows(seeded):
    repo = DashboardOverviewRepository(seeded)

    overview = await repo.overview_geral(YEAR, MONTH, "all", USER, is_admin=False, today=TODAY)

    assert [(p.description, p.amount) for p in overview.installments] == [("expense 33.33", 33.33)]


@pytest.mark.asyncio
@pytest.mark.parametrize("scope", SCOPES)
async def test_statement_totals_match_reference(seeded, scope):
    rows = _in_scope(await _user_rows(seeded), scope)
    dashboard = DashboardRepository(seeded)

    statement = await dashboard.extrato_financeiro(
        MONTH_START,
        datetime(YEAR, MONTH, 31, 23, 59, 59, 999999),
        scope,
        "01/05/2026",
        "31/05/2026",
        USER,
    )

    assert statement.total_income == pytest.approx(_sum(rows, type="income"))
    assert statement.total_expenses == pytest.approx(_sum(rows, type="expense"))
    assert statement.total_invested == pytest.approx(_sum(rows, type="investment"))
    fixed = sum(
        t.amount for t in rows if t.type == "expense" and t.recurring_account_id is not None
    )
    variable = sum(t.amount for t in rows if t.type == "expense" and t.recurring_account_id is None)
    assert statement.fixed_expenses == pytest.approx(fixed)
    assert statement.variable_expenses == pytest.approx(variable)
    assert len(statement.transactions) == len(rows)
    ordered = [(t.transaction_date, t.id) for t in statement.transactions]
    assert ordered == sorted(ordered, reverse=True)


@pytest.mark.asyncio
async def test_statement_with_no_rows_has_zero_totals(seeded):
    dashboard = DashboardRepository(seeded)

    statement = await dashboard.extrato_financeiro(
        datetime(2020, 1, 1), datetime(2020, 1, 31), "all", "01/01/2020", "31/01/2020", USER
    )

    assert statement.transactions == []
    assert statement.total_income == 0
    assert statement.total_expenses == 0
    assert statement.fixed_expenses == 0
    assert statement.variable_expenses == 0


@pytest.mark.asyncio
@pytest.mark.parametrize("scope", SCOPES)
@pytest.mark.parametrize("kind", [TipoTrans.expense, TipoTrans.income])
async def test_expenses_by_category_match_reference(seeded, scope, kind):
    rows = [t for t in _in_scope(await _user_rows(seeded), scope) if t.type == kind.value]
    dashboard = DashboardRepository(seeded)

    result = await dashboard.gastos_por_categoria(
        MONTH_START, datetime(YEAR, MONTH, 31, 23, 59, 59), scope, kind, USER
    )

    expected: dict[int, dict] = {}
    for t in sorted(rows, key=lambda t: t.id):
        entry = expected.setdefault(
            t.category.id,
            {"name": t.category.name, "total": 0.0, "limit": t.category.limit, "subs": {}},
        )
        entry["total"] += t.amount
        entry["subs"][t.subcategory.name] = entry["subs"].get(t.subcategory.name, 0.0) + t.amount

    assert [c["name"] for c in result] == [e["name"] for e in expected.values()]
    for got, want in zip(result, expected.values(), strict=True):
        assert got["total"] == pytest.approx(round(want["total"], 2))
        assert got["limit"] == want["limit"]
        assert [(s["name"], s["amount"]) for s in got["subcategories"]] == [
            (name, f"{round(value, 2):.2f}") for name, value in want["subs"].items()
        ]


@pytest.mark.asyncio
@pytest.mark.parametrize("scope", SCOPES)
async def test_income_by_category_match_reference(seeded, scope):
    rows = [t for t in _in_scope(await _user_rows(seeded), scope) if t.type == "income"]
    dashboard = DashboardRepository(seeded)

    result = await dashboard.entradas_por_categoria(
        MONTH_START,
        datetime(YEAR, MONTH, 31, 23, 59, 59),
        scope,
        "01/05/2026",
        "31/05/2026",
        USER,
    )

    totals: dict[str, float] = defaultdict(float)
    for t in rows:
        totals[t.subcategory.name] += t.amount
    expected = sorted(totals.items(), key=lambda item: item[1], reverse=True)
    assert [(s.name, s.total) for s in result.subcategories] == [
        (name, pytest.approx(round(value, 2))) for name, value in expected
    ]


@pytest.mark.asyncio
async def test_period_income_matches_reference(seeded):
    rows = await _user_rows(seeded)
    dashboard = DashboardRepository(seeded)

    result = await dashboard.rendimento_por_periodo(YEAR, "individual", USER)

    pf = [t for t in rows if t.entity_type == "individual"]
    assert result.months["may"].income == pytest.approx(
        round(_sum(_in_scope(pf, "all"), type="income"), 2)
    )
    assert result.months["may"].expense == pytest.approx(
        round(_sum(_in_scope(pf, "all"), type="expense"), 2)
    )
    april = _in_scope(pf, "all", datetime(YEAR, 4, 1), datetime(YEAR, 5, 1))
    assert result.months["april"].expense == pytest.approx(round(_sum(april, type="expense"), 2))
    assert result.months["january"].income == 0
    assert result.limit == 3000.0


class _QueryCounter:
    """Counts SQL statements sent to the engine while active."""

    def __init__(self, session):
        self.engine = session.bind.sync_engine
        self.statements: list[str] = []

    def _listener(self, conn, cursor, statement, parameters, context, executemany):
        self.statements.append(statement)

    def __enter__(self):
        event.listen(self.engine, "before_cursor_execute", self._listener)
        return self

    def __exit__(self, *exc):
        event.remove(self.engine, "before_cursor_execute", self._listener)


# Upper bounds of statements per call; the data volume must not change them.
OVERVIEW_MAX_QUERIES = 7  # was 13 before the SQL aggregation
STATEMENT_MAX_QUERIES = 3  # rows + totals + limits
BREAKDOWN_MAX_QUERIES = 1


@pytest.mark.asyncio
async def test_overview_query_count_is_bounded(seeded):
    with _QueryCounter(seeded) as counter:
        await DashboardOverviewRepository(seeded).overview_geral(
            YEAR, MONTH, "all", USER, is_admin=False, today=TODAY
        )

    assert len(counter.statements) <= OVERVIEW_MAX_QUERIES, counter.statements


@pytest.mark.asyncio
async def test_statement_query_count_is_bounded(seeded):
    with _QueryCounter(seeded) as counter:
        await DashboardRepository(seeded).extrato_financeiro(
            MONTH_START, MONTH_END, "all", "01/05/2026", "31/05/2026", USER
        )

    assert len(counter.statements) <= STATEMENT_MAX_QUERIES, counter.statements


@pytest.mark.asyncio
async def test_category_breakdowns_use_a_single_query(seeded):
    repo = DashboardRepository(seeded)
    with _QueryCounter(seeded) as counter:
        await repo.gastos_por_categoria(MONTH_START, MONTH_END, "all", TipoTrans.expense, USER)
        await repo.entradas_por_categoria(MONTH_START, MONTH_END, "all", "a", "b", USER)

    assert len(counter.statements) <= 2 * BREAKDOWN_MAX_QUERIES, counter.statements


@pytest.mark.asyncio
async def test_query_count_does_not_grow_with_the_number_of_transactions(seeded):
    repo = DashboardOverviewRepository(seeded)
    with _QueryCounter(seeded) as before:
        await repo.overview_geral(YEAR, MONTH, "all", USER, is_admin=False, today=TODAY)

    categories = await seeded.execute(select(CategoryORM).where(CategoryORM.user_id == USER))
    food = next(c for c in categories.unique().scalars() if c.name == "Food")
    seeded.add_all(
        _tx(USER, food, food.subcategories[0], 1.0 + n, "expense", 1 + n % 28) for n in range(60)
    )
    await seeded.commit()

    with _QueryCounter(seeded) as after:
        await repo.overview_geral(YEAR, MONTH, "all", USER, is_admin=False, today=TODAY)

    assert len(after.statements) == len(before.statements)
