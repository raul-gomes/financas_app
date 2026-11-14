"""Cross-process mutual exclusion through PostgreSQL advisory locks.

Used so that only one backend replica runs a periodic job at a time. On any other
dialect (SQLite in tests and local runs) the lock is a no-op that always succeeds.
"""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncEngine

POSTGRES_DIALECT = "postgresql"

# One distinct key per job; keys share a single global namespace in the database.
LIMIT_ALERT_JOB_LOCK_KEY = 7_302_001


@asynccontextmanager
async def try_advisory_lock(engine: AsyncEngine, key: int) -> AsyncIterator[bool]:
    """Try to take advisory lock ``key`` without waiting.

    Yields ``True`` when the caller owns the lock (released on exit) and ``False``
    when another process holds it. The lock lives on a dedicated connection so it is
    unaffected by commits or rollbacks of the caller's own sessions.
    """
    if engine.dialect.name != POSTGRES_DIALECT:
        yield True
        return

    async with engine.connect() as connection:
        result = await connection.execute(text("SELECT pg_try_advisory_lock(:key)"), {"key": key})
        acquired = bool(result.scalar())
        try:
            yield acquired
        finally:
            if acquired:
                await connection.execute(text("SELECT pg_advisory_unlock(:key)"), {"key": key})
