"""Advisory lock abstraction and the limit-alert job guard (pendencias P5)."""

from contextlib import asynccontextmanager

from sqlalchemy import select

from app.core import advisory_lock
from app.core.advisory_lock import LIMIT_ALERT_JOB_LOCK_KEY, try_advisory_lock
from app.db.models.user import UserORM
from app.services import limit_alert_job
from tests.conftest import TestSessionLocal
from tests.conftest import engine as sqlite_engine


class _FakeResult:
    def __init__(self, value: bool) -> None:
        self._value = value

    def scalar(self) -> bool:
        return self._value


class _FakeConnection:
    """Records the SQL sent to it; `acquired` decides what pg_try_advisory_lock returns."""

    def __init__(self, acquired: bool) -> None:
        self.acquired = acquired
        self.statements: list[tuple[str, dict]] = []

    async def execute(self, statement, params=None) -> _FakeResult:
        self.statements.append((str(statement), params))
        return _FakeResult(self.acquired)


class _FakeDialect:
    name = "postgresql"


class _FakePostgresEngine:
    """Minimal stand-in for an AsyncEngine on PostgreSQL."""

    dialect = _FakeDialect()

    def __init__(self, acquired: bool) -> None:
        self.connection = _FakeConnection(acquired)

    @asynccontextmanager
    async def connect(self):
        yield self.connection


async def test_lock_is_noop_on_non_postgres_dialects() -> None:
    async with try_advisory_lock(sqlite_engine, LIMIT_ALERT_JOB_LOCK_KEY) as acquired:
        assert acquired is True


async def test_postgres_lock_acquires_and_releases() -> None:
    fake = _FakePostgresEngine(acquired=True)
    async with try_advisory_lock(fake, LIMIT_ALERT_JOB_LOCK_KEY) as acquired:
        assert acquired is True
        assert "pg_try_advisory_lock" in fake.connection.statements[0][0]
    assert "pg_advisory_unlock" in fake.connection.statements[-1][0]
    assert fake.connection.statements[-1][1] == {"key": LIMIT_ALERT_JOB_LOCK_KEY}


async def test_postgres_lock_held_elsewhere_is_reported_and_not_unlocked() -> None:
    fake = _FakePostgresEngine(acquired=False)
    async with try_advisory_lock(fake, LIMIT_ALERT_JOB_LOCK_KEY) as acquired:
        assert acquired is False
    assert len(fake.connection.statements) == 1


async def test_job_skips_the_round_when_lock_is_held(monkeypatch) -> None:
    evaluated: list[bool] = []

    @asynccontextmanager
    async def lock_held(_engine, _key):
        yield False

    async def fake_evaluate(_session) -> int:
        evaluated.append(True)
        return 5

    monkeypatch.setattr(limit_alert_job, "try_advisory_lock", lock_held)
    monkeypatch.setattr(limit_alert_job, "evaluate_all_users_current_month", fake_evaluate)
    assert await limit_alert_job.run_evaluation_once() == 0
    assert evaluated == []


async def test_job_runs_the_round_when_lock_is_free(monkeypatch) -> None:
    async def fake_evaluate(_session) -> int:
        return 3

    monkeypatch.setattr(limit_alert_job, "evaluate_all_users_current_month", fake_evaluate)
    monkeypatch.setattr(limit_alert_job, "AsyncSessionLocal", TestSessionLocal)
    monkeypatch.setattr(limit_alert_job, "engine", sqlite_engine)
    assert await limit_alert_job.run_evaluation_once() == 3


def test_lock_key_is_a_named_constant() -> None:
    assert isinstance(advisory_lock.LIMIT_ALERT_JOB_LOCK_KEY, int)


async def test_loading_a_user_does_not_eager_load_banks(async_session) -> None:
    """Every authenticated request loads the user; it must be a single SELECT."""
    async_session.add(UserORM(id=1, name="U", email="u@example.com"))
    await async_session.commit()
    async_session.expunge_all()

    statements: list[str] = []

    def record(_conn, _cursor, statement, *_args) -> None:
        statements.append(statement)

    from sqlalchemy import event

    sync_engine = async_session.bind.sync_engine
    event.listen(sync_engine, "before_cursor_execute", record)
    try:
        await async_session.execute(select(UserORM).where(UserORM.id == 1))
    finally:
        event.remove(sync_engine, "before_cursor_execute", record)

    assert len(statements) == 1
    assert "user_banks" not in statements[0]


async def test_loading_a_transaction_does_not_eager_load_recurring_account(async_session) -> None:
    """Default transaction loads must not issue the extra recurring_accounts SELECT."""
    from sqlalchemy import event

    from app.db.models.transaction import TransactionORM

    statements: list[str] = []

    def record(_conn, _cursor, statement, *_args) -> None:
        statements.append(statement)

    event.listen(async_session.bind.sync_engine, "before_cursor_execute", record)
    try:
        await async_session.execute(select(TransactionORM).where(TransactionORM.id == 1))
    finally:
        event.remove(async_session.bind.sync_engine, "before_cursor_execute", record)

    assert len(statements) == 1
