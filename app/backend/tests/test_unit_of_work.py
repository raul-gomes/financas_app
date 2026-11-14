"""Unit of work: one commit/rollback point per request, side effects only after commit."""

import pytest
from fastapi import Depends, FastAPI, HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.core.database import get_session
from app.core.unit_of_work import UnitOfWork, get_unit_of_work
from app.db.models.user import UserORM


async def _count_users(session) -> int:
    return len((await session.execute(select(UserORM.id))).all())


@pytest.mark.asyncio
async def test_commit_runs_callbacks_after_the_commit(async_session):
    uow = UnitOfWork(async_session)
    seen: list[int] = []

    async def callback() -> None:
        seen.append(await _count_users(async_session))

    async_session.add(UserORM(id=1, name="A", email="a@example.com"))
    uow.after_commit(callback)
    await uow.commit()

    assert seen == [1]


@pytest.mark.asyncio
async def test_failing_callback_does_not_undo_the_commit(async_session):
    uow = UnitOfWork(async_session)

    async def boom() -> None:
        raise RuntimeError("side effect failed")

    async_session.add(UserORM(id=1, name="A", email="a@example.com"))
    uow.after_commit(boom)
    await uow.commit()

    assert await _count_users(async_session) == 1


@pytest.mark.asyncio
async def test_rollback_discards_changes_and_pending_callbacks(async_session):
    uow = UnitOfWork(async_session)
    called: list[bool] = []

    async def callback() -> None:
        called.append(True)

    async_session.add(UserORM(id=1, name="A", email="a@example.com"))
    uow.after_commit(callback)
    await uow.rollback()
    await uow.commit()

    assert await _count_users(async_session) == 0
    assert called == []


def _build_app(session) -> FastAPI:
    """Tiny app that writes through the unit-of-work dependency."""
    app = FastAPI()

    async def override_session():
        yield session

    app.dependency_overrides[get_session] = override_session

    @app.post("/ok")
    async def ok(uow: UnitOfWork = Depends(get_unit_of_work, scope="function")) -> dict:
        uow.session.add(UserORM(id=1, name="A", email="a@example.com"))
        return {"ok": True}

    @app.post("/fail")
    async def fail(uow: UnitOfWork = Depends(get_unit_of_work, scope="function")) -> dict:
        uow.session.add(UserORM(id=2, name="B", email="b@example.com"))
        await uow.session.flush()
        raise HTTPException(status_code=409, detail="conflict")

    return app


@pytest.mark.asyncio
async def test_dependency_commits_when_the_handler_succeeds(async_session):
    app = _build_app(async_session)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as client:
        response = await client.post("/ok")

    assert response.status_code == 200
    async_session.expire_all()
    assert await _count_users(async_session) == 1


@pytest.mark.asyncio
async def test_dependency_rolls_back_when_the_handler_raises(async_session):
    app = _build_app(async_session)
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://t") as client:
        response = await client.post("/fail")

    assert response.status_code == 409
    assert await _count_users(async_session) == 0
