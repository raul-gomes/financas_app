from datetime import UTC, datetime

import pytest
import time_machine

from app.db.models.category import CategoryORM, SubcategoryORM
from app.db.models.transaction import TransactionORM
from app.db.models.user import UserORM
from app.services.limit_alert_service import (
    evaluate_all_users_current_month,
)

# Fixtures use September 2026 data, so pin "now" to that month.
FROZEN_NOW = datetime(2026, 9, 20, 12, 0, tzinfo=UTC)


@pytest.fixture(autouse=True)
def _frozen_clock():
    """Freeze the clock so month-relative logic matches the hardcoded fixtures."""
    with time_machine.travel(FROZEN_NOW, tick=False):
        yield


@pytest.fixture
def _user_gasto(async_session):
    async def _seed(limit=1000.0, spent=1050.0, user_id=1):
        user = UserORM(id=user_id, name="Teste", email="a@b.com", role="admin")
        async_session.add(user)
        await async_session.flush()
        cat = CategoryORM(
            name="Alimentacao", entity_type="individual", limit=limit, user_id=user_id
        )
        async_session.add(cat)
        await async_session.flush()
        sub = SubcategoryORM(name="Supermercado", category_id=cat.id)
        async_session.add(sub)
        await async_session.flush()
        async_session.add(
            TransactionORM(
                amount=spent,
                description="Compras",
                transaction_date=datetime(2026, 9, 15),
                type="expense",
                entity_type="individual",
                payment_method="pix",
                category_id=cat.id,
                subcategory_id=sub.id,
                user_id=user_id,
            )
        )
        await async_session.flush()
        return cat

    return _seed


@pytest.mark.asyncio
async def test_trigger_limit_evaluation_mes_atual(async_session, _user_gasto):
    await _user_gasto()
    criados = await evaluate_all_users_current_month(async_session)
    assert criados >= 1
    # Idempotente
    criados2 = await evaluate_all_users_current_month(async_session)
    assert criados2 == 0


@pytest.mark.asyncio
async def test_trigger_limit_evaluation_sem_usuarios_dosnovou(async_session):
    criados = await evaluate_all_users_current_month(async_session)
    assert criados == 0


@pytest.mark.asyncio
async def test_trigger_nao_quebra_por_usuario_sem_email(async_session, _user_gasto):
    # user sem email (vazio): avaliação não deve levantar
    await _user_gasto()
    u = await async_session.get(UserORM, 1)
    u.email = ""
    await async_session.flush()
    criados = await evaluate_all_users_current_month(async_session)
    assert criados >= 1
