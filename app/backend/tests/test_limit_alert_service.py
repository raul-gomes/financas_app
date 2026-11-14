import pytest
from sqlalchemy import select

from app.db.models.category import CategoryORM, SubcategoryORM
from app.db.models.limit_alert import LimitAlertORM
from app.db.models.transaction import TransactionORM
from app.db.models.user import UserORM
from app.services.limit_alert_service import LimitAlertService


async def _seed_categoria_e_gasto(async_session, limit, spent, monthly=True, payment_method="pix"):
    user = UserORM(id=1, name="Teste", email="alert@teste.com", password_hash="", role="admin")
    async_session.add(user)
    await async_session.flush()

    cat = CategoryORM(name="Alimentacao", entity_type="individual", limit=limit, user_id=1)
    async_session.add(cat)
    await async_session.flush()
    sub = SubcategoryORM(name="Supermercado", category_id=cat.id)
    async_session.add(sub)
    await async_session.flush()

    async_session.add(
        TransactionORM(
            amount=spent,
            description="Compras",
            transaction_date=__import__("datetime").datetime(2026, 9, 15),
            type="expense",
            entity_type="individual",
            payment_method=payment_method,
            category_id=cat.id,
            subcategory_id=sub.id,
            user_id=1,
        )
    )
    await async_session.flush()
    return user, cat


async def _count_alerts(async_session, user_id=1, month="2026-09"):
    stmt = select(LimitAlertORM).where(
        LimitAlertORM.user_id == user_id,
        LimitAlertORM.month == month,
    )
    result = await async_session.execute(stmt)
    return list(result.unique().scalars().all())


@pytest.mark.asyncio
async def test_68_porcento_nao_gera_alerta(async_session):
    await _seed_categoria_e_gasto(async_session, limit=1000, spent=680)
    criados = await LimitAlertService(async_session).evaluate_limits(1, 2026, 9)
    assert criados == []
    assert await _count_alerts(async_session) == []


@pytest.mark.asyncio
async def test_72_porcento_nao_gera_alerta(async_session):
    """Abaixo de 80% nenhum alerta deve ser criado (threshold inicial é 80)."""
    await _seed_categoria_e_gasto(async_session, limit=1000, spent=720)
    criados = await LimitAlertService(async_session).evaluate_limits(1, 2026, 9)
    assert criados == []
    assert await _count_alerts(async_session) == []


@pytest.mark.asyncio
async def test_85_porcento_gera_alerta_threshold_80(async_session):
    await _seed_categoria_e_gasto(async_session, limit=1000, spent=850)
    criados = await LimitAlertService(async_session).evaluate_limits(1, 2026, 9)
    thresholds = sorted(a.threshold for a in criados)
    assert thresholds == [80]


@pytest.mark.asyncio
async def test_95_porcento_gera_80_e_90(async_session):
    await _seed_categoria_e_gasto(async_session, limit=1000, spent=950)
    criados = await LimitAlertService(async_session).evaluate_limits(1, 2026, 9)
    thresholds = sorted(a.threshold for a in criados)
    assert thresholds == [80, 90]


@pytest.mark.asyncio
async def test_105_porcento_gera_todos_com_exceeded_true(async_session):
    await _seed_categoria_e_gasto(async_session, limit=1000, spent=1050)
    criados = await LimitAlertService(async_session).evaluate_limits(1, 2026, 9)
    thresholds = sorted(a.threshold for a in criados)
    assert thresholds == [80, 90, 100]
    assert all(a.exceeded for a in criados)
    assert all(a.percent_used == 105.0 for a in criados)


@pytest.mark.asyncio
async def test_reavaliacao_mesmo_mes_nao_duplica(async_session):
    await _seed_categoria_e_gasto(async_session, limit=1000, spent=850)
    srv = LimitAlertService(async_session)
    await srv.evaluate_limits(1, 2026, 9)
    await srv.evaluate_limits(1, 2026, 9)
    assert len(await _count_alerts(async_session)) == 1  # só o threshold 80


@pytest.mark.asyncio
async def test_categoria_sem_limite_nao_gera_alerta(async_session):
    await _seed_categoria_e_gasto(async_session, limit=0, spent=850)
    criados = await LimitAlertService(async_session).evaluate_limits(1, 2026, 9)
    assert criados == []


@pytest.mark.asyncio
async def test_cartaol_quase_no_limite_gera_alerta_scope_credit_card(async_session):
    user = UserORM(id=1, name="Teste", email="alert@teste.com", password_hash="", role="admin")
    async_session.add(user)
    await async_session.flush()
    card_cat = CategoryORM(
        name="Limite Cartao Credito", entity_type="individual", limit=2000.0, user_id=1
    )
    async_session.add(card_cat)
    await async_session.flush()
    sub = SubcategoryORM(name="Fatura", category_id=card_cat.id)
    async_session.add(sub)
    await async_session.flush()
    async_session.add(
        TransactionORM(
            amount=1700.0,
            description="Fatura cartao",
            transaction_date=__import__("datetime").datetime(2026, 9, 10),
            type="expense",
            entity_type="individual",
            payment_method="credit",
            category_id=card_cat.id,
            subcategory_id=sub.id,
            user_id=1,
        )
    )
    await async_session.flush()

    criados = await LimitAlertService(async_session).evaluate_limits(1, 2026, 9)
    assert criados, "deveria gerar alertas para o cartão a 85% do limite"
    assert all(a.scope == "credit_card" for a in criados)
    assert sorted(a.threshold for a in criados) == [80]
    # Reavaliar não duplica o alerta de cartão
    await LimitAlertService(async_session).evaluate_limits(1, 2026, 9)
    assert len(await _count_alerts(async_session)) == 1
