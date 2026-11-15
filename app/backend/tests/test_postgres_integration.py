"""PostgreSQL-only paths, against a real database migrated with ``alembic upgrade head``.

Skipped unless ``TEST_POSTGRES_URL`` (``postgresql+asyncpg://...``) points to a throwaway
database: the schema is dropped and rebuilt, never aim it at real data. The SQLite suite
covers the same logic as far as SQLite can; these tests cover what only PostgreSQL does
(advisory locks, savepoint semantics after a failed statement, partial unique indexes, real
column limits and ordering).
"""

import asyncio
import os
from collections.abc import AsyncIterator
from datetime import datetime
from pathlib import Path

import pytest
import pytest_asyncio
from alembic import command
from alembic.config import Config as AlembicConfig
from sqlalchemy import event, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import NullPool

from app.core.advisory_lock import LIMIT_ALERT_JOB_LOCK_KEY, try_advisory_lock
from app.core.config import Config
from app.core.unit_of_work import UnitOfWork
from app.db.models.category import CategoryORM, SubcategoryORM
from app.db.models.transaction import EXTERNAL_ID_MAX_LENGTH, TransactionORM
from app.db.models.user import UserORM
from app.db.repositories.category import CategoriaRepository
from app.db.repositories.recurring_account import ContaRecorrenteRepository
from app.db.repositories.transaction import (
    TransacaoRepository,
    TransactionCursor,
    TransactionFilters,
)
from app.schemas.limits import CategoriaLimiteUpdate, LimitsUpdatePayload
from app.schemas.recurring_account import ContaRecorrenteCreate
from app.services.limits_service import GENERIC_ITEM_ERROR, LimitsService
from app.services.recurring_account_service import RecurringAccountService

pytestmark = pytest.mark.postgres

TEST_POSTGRES_URL = os.environ.get("TEST_POSTGRES_URL")
BACKEND_DIR = Path(__file__).resolve().parent.parent
PAGE_SIZE = 3
SAME_DAY = datetime(2026, 4, 10, 12, 0, 0)


@pytest.fixture(scope="session")
def migrated_postgres_url() -> str:
    """Rebuilds the public schema of the test database and applies every migration."""
    if not TEST_POSTGRES_URL:
        pytest.skip("TEST_POSTGRES_URL is not set")
    assert TEST_POSTGRES_URL.startswith("postgresql+asyncpg://")

    async def reset_schema() -> None:
        reset_engine = create_async_engine(TEST_POSTGRES_URL, poolclass=NullPool)
        async with reset_engine.begin() as conn:
            await conn.execute(text("DROP SCHEMA public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
        await reset_engine.dispose()

    asyncio.run(reset_schema())

    alembic_config = AlembicConfig(str(BACKEND_DIR / "alembic.ini"))
    alembic_config.set_main_option("script_location", str(BACKEND_DIR / "app/db/migrations"))
    # env.py reads the URL from Config at run time.
    original_url = Config.DATABASE_URL
    Config.DATABASE_URL = TEST_POSTGRES_URL
    try:
        command.upgrade(alembic_config, "head")
    finally:
        Config.DATABASE_URL = original_url
    return TEST_POSTGRES_URL


@pytest_asyncio.fixture
async def pg_engine(migrated_postgres_url: str) -> AsyncIterator[AsyncEngine]:
    """An engine on the migrated database, emptied before each test."""
    engine = create_async_engine(migrated_postgres_url, poolclass=NullPool)
    async with engine.begin() as conn:
        await conn.execute(text("TRUNCATE users RESTART IDENTITY CASCADE"))
    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def pg_session(pg_engine: AsyncEngine) -> AsyncIterator[AsyncSession]:
    """A session on the migrated database."""
    async with async_sessionmaker(pg_engine, expire_on_commit=False)() as session:
        yield session


async def _user_uow(session: AsyncSession, user_id: int = 1) -> tuple[UnitOfWork, UserORM]:
    """Creates a committed user and returns a unit of work over the session."""
    session.add(UserORM(id=user_id, name="U", email=f"u{user_id}@example.com", role="admin"))
    await session.commit()
    return UnitOfWork(session), await session.get(UserORM, user_id)


async def _category(session: AsyncSession, user_id: int) -> CategoryORM:
    """Creates a category with one subcategory for the user."""
    category = CategoryORM(
        name=f"Cat {user_id}", entity_type="individual", limit=0, user_id=user_id
    )
    category.subcategories = [SubcategoryORM(name="Sub")]
    session.add(category)
    await session.flush()
    return category


def _transaction(category: CategoryORM, user_id: int, **extra) -> TransactionORM:
    """A minimal valid transaction row."""
    data = {
        "amount": 10.0,
        "description": "Row",
        "transaction_date": SAME_DAY,
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_id": category.id,
        "subcategory_id": category.subcategories[0].id,
        "user_id": user_id,
    }
    return TransactionORM(**(data | extra))


async def _count(session: AsyncSession, model) -> int:
    return (await session.execute(select(func.count()).select_from(model))).scalar_one()


async def test_migrations_leave_the_provider_unique_index_in_place(pg_session: AsyncSession):
    """The partial index created by the migration is a real, unique, partial index."""
    definition = (
        await pg_session.execute(
            text("SELECT indexdef FROM pg_indexes WHERE indexname = 'uq_transacoes_user_external'")
        )
    ).scalar_one()

    assert "UNIQUE" in definition
    assert "external_id IS NOT NULL" in definition


async def test_unique_index_rejects_a_repeated_provider_id_per_user_only(pg_session: AsyncSession):
    await _user_uow(pg_session, 1)
    await _user_uow(pg_session, 2)
    cat1, cat2 = await _category(pg_session, 1), await _category(pg_session, 2)
    pg_session.add_all(
        [
            _transaction(cat1, 1, external_source="pluggy", external_id="tx-1"),
            # Same provider id for another user, another source, or no id at all: all allowed.
            _transaction(cat2, 2, external_source="pluggy", external_id="tx-1"),
            _transaction(cat1, 1, external_source="other", external_id="tx-1"),
            _transaction(cat1, 1),
            _transaction(cat1, 1),
        ]
    )
    await pg_session.flush()

    pg_session.add(_transaction(cat1, 1, external_source="pluggy", external_id="tx-1"))
    with pytest.raises(IntegrityError):
        await pg_session.flush()


async def test_installments_are_one_bulk_insert_and_skip_existing_months(
    pg_engine: AsyncEngine, pg_session: AsyncSession
):
    uow, user = await _user_uow(pg_session)
    payload = ContaRecorrenteCreate(
        description="Rent",
        amount=1500.0,
        due_day=10,
        category_name="Housing",
        subcategory_name="Rent",
        entity_type="individual",
        payment_method="pix",
        start_date="2026-03-01T00:00:00",
        total_installments=4,
    )
    account = await RecurringAccountService(uow, user).create(payload)
    assert await _count(pg_session, TransactionORM) == 4
    first = (
        (
            await pg_session.execute(
                select(TransactionORM).order_by(TransactionORM.transaction_date).limit(1)
            )
        )
        .unique()
        .scalar_one()
    )
    await pg_session.delete(first)
    await pg_session.flush()

    statements: list[str] = []

    def capture(conn, cursor, statement, parameters, context, executemany):
        statements.append(statement)

    repo = ContaRecorrenteRepository(pg_session)
    sync_engine = pg_engine.sync_engine
    event.listen(sync_engine, "before_cursor_execute", capture)
    try:
        created = await repo._generate_installments(account, user.id)
    finally:
        event.remove(sync_engine, "before_cursor_execute", capture)

    assert created == 1
    assert await _count(pg_session, TransactionORM) == 4
    inserts = [s for s in statements if s.lstrip().upper().startswith("INSERT INTO TRANSACOES")]
    assert len(inserts) == 1
    assert await repo._generate_installments(account, user.id) == 0


async def test_advisory_lock_second_holder_skips_until_released(pg_engine: AsyncEngine):
    async with try_advisory_lock(pg_engine, LIMIT_ALERT_JOB_LOCK_KEY) as first:
        async with try_advisory_lock(pg_engine, LIMIT_ALERT_JOB_LOCK_KEY) as second:
            assert (first, second) == (True, False)
        async with try_advisory_lock(pg_engine, LIMIT_ALERT_JOB_LOCK_KEY + 1) as other_key:
            assert other_key is True

    async with try_advisory_lock(pg_engine, LIMIT_ALERT_JOB_LOCK_KEY) as after_release:
        assert after_release is True


async def test_bulk_limits_failed_item_aborts_only_its_savepoint(
    pg_session: AsyncSession, monkeypatch
):
    """A statement error aborts a PostgreSQL transaction unless a savepoint contains it."""
    original_create = CategoriaRepository.create

    async def create_or_fail(self, user_id, obj_in, **kwargs):
        if obj_in.category_name == "Broken":
            await self.db.execute(text("SELECT 1/0"))
        return await original_create(self, user_id, obj_in, **kwargs)

    monkeypatch.setattr(CategoriaRepository, "create", create_or_fail)
    uow, user = await _user_uow(pg_session)

    def item(name: str) -> CategoriaLimiteUpdate:
        return CategoriaLimiteUpdate(
            category_name=name, entity_type="individual", limit=10.0, subcategories=[]
        )

    response = await LimitsService(uow, user).bulk_update(
        LimitsUpdatePayload(new=[item("Good"), item("Broken"), item("Also good")])
    )
    await uow.commit()

    assert response.success is False
    assert response.created_categories == 2
    assert response.errors == [f"Erro ao criar categoria 'Broken': {GENERIC_ITEM_ERROR}"]
    names = (
        await pg_session.execute(select(CategoryORM.name).order_by(CategoryORM.name))
    ).scalars()
    assert list(names) == ["Also good", "Good"]


async def test_extract_batch_failure_rolls_back_the_batch_and_keeps_the_request_usable(
    pg_session: AsyncSession,
):
    """A real column-length error (SQLite ignores it) is contained by the batch savepoint."""
    uow, user = await _user_uow(pg_session)
    category = await _category(pg_session, user.id)
    user.name = "Written before the batch"
    row = {
        "date": "10/04/2026",
        "description": "Row",
        "amount": 10.0,
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_id": category.id,
        "subcategory_id": category.subcategories[0].id,
    }
    too_long = {**row, "external_id": "x" * (EXTERNAL_ID_MAX_LENGTH + 1), "external_source": "t"}

    created, errors = await TransacaoRepository(pg_session).create_batch_returning_rows(
        [row, too_long], user.id
    )
    await uow.commit()

    assert created == []
    assert errors == ["Erro no commit em lote"]
    assert await _count(pg_session, TransactionORM) == 0
    assert (await pg_session.get(UserORM, user.id)).name == "Written before the batch"
    ok, no_errors = await TransacaoRepository(pg_session).create_batch_returning_rows(
        [row], user.id
    )
    assert (len(ok), no_errors) == (1, [])


async def test_keyset_pages_follow_date_desc_id_desc_without_gaps_or_repeats(
    pg_session: AsyncSession,
):
    _, user = await _user_uow(pg_session)
    category = await _category(pg_session, user.id)
    _, other = await _user_uow(pg_session, 2)
    other_category = await _category(pg_session, other.id)
    # Many ties on the same timestamp exercise the id tiebreaker; another user's rows never show.
    pg_session.add_all(
        [_transaction(category, user.id, transaction_date=SAME_DAY) for _ in range(5)]
        + [
            _transaction(category, user.id, transaction_date=datetime(2026, 4, day))
            for day in (1, 20, 30)
        ]
        + [_transaction(other_category, other.id, transaction_date=SAME_DAY)]
    )
    await pg_session.commit()
    repo = TransacaoRepository(pg_session)

    seen: list[tuple[datetime, int]] = []
    cursor: TransactionCursor | None = None
    pages = 0
    while True:
        page = await repo.list_page(user.id, TransactionFilters(), PAGE_SIZE, cursor)
        assert page.total == 8
        seen.extend((t.transaction_date, t.id) for t in page.items)
        pages += 1
        if page.next_cursor is None:
            break
        cursor = page.next_cursor

    assert pages == 3
    assert seen == sorted(seen, reverse=True)
    assert len(seen) == len(set(seen)) == 8
    expected = (
        await pg_session.execute(
            select(TransactionORM.transaction_date, TransactionORM.id)
            .where(TransactionORM.user_id == user.id)
            .order_by(TransactionORM.transaction_date.desc(), TransactionORM.id.desc())
        )
    ).all()
    assert seen == [(d, i) for d, i in expected]
