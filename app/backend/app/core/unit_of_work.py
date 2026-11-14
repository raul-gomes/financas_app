"""Unit of work: the single place where a request's transaction is committed or rolled back.

Pattern (see AGENTS.md, "Layers and unit of work"):

- Repositories and services only ``add``/``flush``/``refresh``; they never commit.
- The route receives a service whose session comes from :func:`get_unit_of_work`.
- When the handler returns, the dependency commits once; when it raises, it rolls back.
- Side effects that must only happen once the data is durable (for example evaluating
  limit alerts) are registered with :meth:`UnitOfWork.after_commit`.
"""

from collections.abc import AsyncIterator, Awaitable, Callable

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.logger import logger

AfterCommitCallback = Callable[[], Awaitable[None]]


class UnitOfWork:
    """Wraps the request's :class:`AsyncSession` and owns its commit/rollback."""

    def __init__(self, session: AsyncSession) -> None:
        """Binds the unit of work to the request's session."""
        self.session = session
        self._after_commit: list[AfterCommitCallback] = []

    def after_commit(self, callback: AfterCommitCallback) -> None:
        """Registers a best-effort side effect to run right after a successful commit."""
        self._after_commit.append(callback)

    async def commit(self) -> None:
        """Commits the transaction, then runs the registered callbacks.

        A failing callback is logged and never undoes (or fails) the commit: callbacks are
        side effects of data that is already durable.
        """
        await self.session.commit()
        callbacks, self._after_commit = self._after_commit, []
        for callback in callbacks:
            try:
                await callback()
            except Exception:  # best-effort side effect: logged, never fails the request
                logger.opt(exception=True).warning("after-commit callback failed")

    async def rollback(self) -> None:
        """Rolls the transaction back and forgets the pending callbacks."""
        self._after_commit.clear()
        await self.session.rollback()


async def get_unit_of_work(
    session: AsyncSession = Depends(get_session),
) -> AsyncIterator[UnitOfWork]:
    """FastAPI dependency: yields a unit of work, committing on success, rolling back on error.

    Declare it with ``Depends(get_unit_of_work, scope="function")`` so the commit happens
    before the response is sent (a failing commit then becomes a 500, not a lost write).
    """
    uow = UnitOfWork(session)
    try:
        yield uow
    except BaseException:
        await uow.rollback()
        raise
    await uow.commit()
