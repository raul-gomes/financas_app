"""NotificationService: alerts scoped to the authenticated user, one commit per request."""

import pytest
from sqlalchemy import func, select

from app.db.models.category import CategoryORM
from app.db.models.limit_alert import LimitAlertORM
from app.db.repositories.limit_alert import LimitAlertRepository
from app.services.notification_service import NotificationService


async def _seed_alert(session, user_id: int, threshold: int = 80) -> int:
    category = CategoryORM(
        name=f"Food {threshold}", entity_type="individual", limit=100.0, user_id=user_id
    )
    session.add(category)
    await session.flush()
    alert = await LimitAlertRepository(session).create(
        user_id=user_id,
        category_id=category.id,
        month="2026-09",
        threshold=threshold,
        exceeded=False,
        percent_used=float(threshold) + 5,
    )
    await session.commit()
    return alert.id


async def _unread(session, user_id: int) -> int:
    stmt = (
        select(func.count())
        .select_from(LimitAlertORM)
        .where(LimitAlertORM.user_id == user_id, LimitAlertORM.read_at.is_(None))
    )
    return (await session.execute(stmt)).scalar_one()


@pytest.mark.asyncio
async def test_list_returns_only_the_users_alerts_with_computed_severity(async_session, make_uow):
    uow, user = await make_uow(1)
    await make_uow(2)
    await _seed_alert(async_session, 1, threshold=90)
    await _seed_alert(async_session, 2, threshold=80)

    response = await NotificationService(uow, user).list_notifications()

    assert response.unread_count == 1
    assert [(item.threshold, item.severity, item.read) for item in response.items] == [
        (90, "critical", False)
    ]


@pytest.mark.asyncio
async def test_mark_read_changes_nothing_durable_until_the_unit_of_work_commits(
    async_session, make_uow
):
    uow, user = await make_uow(1)
    alert_id = await _seed_alert(async_session, 1)
    service = NotificationService(uow, user)

    response = await service.mark_read(alert_id)
    assert (response.success, response.updated) == (True, 1)
    await uow.rollback()
    uow, user = await make_uow(1)
    assert await _unread(async_session, 1) == 1

    await NotificationService(uow, user).mark_read(alert_id)
    await uow.commit()
    assert await _unread(async_session, 1) == 0


@pytest.mark.asyncio
async def test_mark_read_of_an_unknown_or_foreign_alert_is_not_an_error(async_session, make_uow):
    owner_alert = await _seed_alert(async_session, 1)
    uow, intruder = await make_uow(2)
    service = NotificationService(uow, intruder)

    for alert_id in (owner_alert, 987654):
        response = await service.mark_read(alert_id)
        assert (response.success, response.updated) == (False, 0)

    assert await _unread(async_session, 1) == 1


@pytest.mark.asyncio
async def test_mark_all_read_only_touches_the_users_alerts(async_session, make_uow):
    await _seed_alert(async_session, 1, 80)
    await _seed_alert(async_session, 1, 90)
    await _seed_alert(async_session, 2, 80)
    uow, user = await make_uow(1)

    response = await NotificationService(uow, user).mark_all_read()
    await uow.commit()

    assert (response.success, response.updated) == (True, 2)
    assert await _unread(async_session, 1) == 0
    assert await _unread(async_session, 2) == 1
