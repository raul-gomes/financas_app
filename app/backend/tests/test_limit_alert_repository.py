import pytest
import pytest_asyncio
from sqlalchemy.exc import IntegrityError

from app.db.models.category import CategoryORM
from app.db.models.user import UserORM
from app.db.repositories.limit_alert import LimitAlertRepository


@pytest_asyncio.fixture
async def seed_user(async_session):
    user = UserORM(
        id=1,
        name="Teste",
        email="alert@teste.com",
        password_hash="",
        role="admin",
    )
    async_session.add(user)
    await async_session.flush()
    return user


@pytest_asyncio.fixture
async def seed_category(async_session):
    cat = CategoryORM(name="Alimentacao", entity_type="individual", limit=1000.0, user_id=1)
    async_session.add(cat)
    await async_session.flush()
    return cat


@pytest.mark.asyncio
async def test_criar_alerta_basico(async_session, seed_user, seed_category):
    repo = LimitAlertRepository(async_session)
    alerta = await repo.create(
        user_id=1,
        category_id=seed_category.id,
        scope="category",
        month="2026-09",
        threshold=70,
        exceeded=False,
        percent_used=72.5,
    )
    assert alerta.id is not None
    assert alerta.threshold == 70
    assert alerta.percent_used == 72.5
    assert alerta.read_at is None
    assert alerta.email_sent is False


@pytest.mark.asyncio
async def test_unique_constraint_user_categoria_mes_threshold(async_session, seed_user, seed_category):
    repo = LimitAlertRepository(async_session)
    await repo.create(
        user_id=1,
        category_id=seed_category.id,
        scope="category",
        month="2026-09",
        threshold=80,
        exceeded=False,
        percent_used=85.0,
    )
    await async_session.commit()
    with pytest.raises((IntegrityError, Exception)):
        await repo.create(
            user_id=1,
            category_id=seed_category.id,
            scope="category",
            month="2026-09",
            threshold=80,
            exceeded=False,
            percent_used=86.0,
        )
        await async_session.commit()


@pytest.mark.asyncio
async def test_exists_detecta_ja_criado(async_session, seed_user, seed_category):
    repo = LimitAlertRepository(async_session)
    assert await repo.exists(user_id=1, category_id=seed_category.id, month="2026-09", threshold=70) is False
    await repo.create(
        user_id=1,
        category_id=seed_category.id,
        scope="category",
        month="2026-09",
        threshold=70,
        exceeded=False,
        percent_used=72.0,
    )
    await async_session.commit()
    assert await repo.exists(user_id=1, category_id=seed_category.id, month="2026-09", threshold=70) is True


@pytest.mark.asyncio
async def test_lista_por_usuario_ordena_mais_recente(async_session, seed_user, seed_category):
    repo = LimitAlertRepository(async_session)
    a1 = await repo.create(
        user_id=1, category_id=seed_category.id, scope="category", month="2026-09",
        threshold=70, exceeded=False, percent_used=72.0,
    )
    a2 = await repo.create(
        user_id=1, category_id=seed_category.id, scope="category", month="2026-09",
        threshold=90, exceeded=False, percent_used=92.0,
    )
    await async_session.commit()
    alertas = await repo.list_by_user(user_id=1)
    assert len(alertas) == 2
    assert alertas[0].id == a2.id  # mais recente primeiro


@pytest.mark.asyncio
async def test_unread_count(async_session, seed_user, seed_category):
    repo = LimitAlertRepository(async_session)
    await repo.create(
        user_id=1, category_id=seed_category.id, scope="category", month="2026-09",
        threshold=70, exceeded=False, percent_used=72.0,
    )
    lido = await repo.create(
        user_id=1, category_id=seed_category.id, scope="category", month="2026-09",
        threshold=80, exceeded=False, percent_used=85.0,
    )
    await async_session.commit()
    await repo.mark_read(lido.id, user_id=1)
    await async_session.commit()
    assert await repo.unread_count(user_id=1) == 1


@pytest.mark.asyncio
async def test_mark_read_mark_all_read(async_session, seed_user, seed_category):
    repo = LimitAlertRepository(async_session)
    await repo.create(
        user_id=1, category_id=seed_category.id, scope="category", month="2026-09",
        threshold=70, exceeded=False, percent_used=72.0,
    )
    await repo.create(
        user_id=1, category_id=seed_category.id, scope="category", month="2026-09",
        threshold=80, exceeded=False, percent_used=85.0,
    )
    await async_session.commit()
    marcados = await repo.mark_all_read(user_id=1)
    await async_session.commit()
    assert marcados == 2
    assert await repo.unread_count(user_id=1) == 0