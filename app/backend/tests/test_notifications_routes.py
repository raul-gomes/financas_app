import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app
from app.core.database import get_session
from app.core.security import get_current_user
from app.db.models.user import UserORM
from app.db.repositories.limit_alert import LimitAlertRepository


@pytest_asyncio.fixture
async def notif_client(async_session):
    """Cliente com controle do session — permite semear alertas direto no banco."""
    user = UserORM(
        id=1, name="Teste", email="teste@teste.com",
        password_hash="", role="admin",
    )
    async_session.add(user)
    await async_session.flush()

    async def override_get_session():
        yield async_session

    app.dependency_overrides[get_session] = override_get_session

    async def override_get_current_user():
        return user

    app.dependency_overrides[get_current_user] = override_get_current_user

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c, async_session

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_list_notifications_vazio(notif_client):
    client, session = notif_client
    response = await client.get("/notifications/")
    assert response.status_code == 200
    data = response.json()
    assert data["unread_count"] == 0
    assert data["items"] == []


@pytest.mark.asyncio
async def test_list_notifications_obriga_auth(client_no_auth):
    response = await client_no_auth.get("/notifications/")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_notifications_com_itens_computados(notif_client):
    client, session = notif_client
    from app.db.models.category import CategoryORM

    cat = CategoryORM(id=10, name="Alimentacao", entity_type="individual", limit=1000.0, user_id=1)
    session.add(cat)
    await session.flush()

    repo = LimitAlertRepository(session)
    a1 = await repo.create(user_id=1, category_id=10, month="2026-09", threshold=70,
                           exceeded=False, percent_used=85.0, scope="category")
    a2 = await repo.create(user_id=1, category_id=10, month="2026-09", threshold=100,
                           exceeded=True, percent_used=110.0, scope="category")
    await session.commit()

    response = await client.get("/notifications/")
    assert response.status_code == 200
    data = response.json()
    assert data["unread_count"] == 2
    itens = {i["threshold"]: i for i in data["items"]}
    assert itens[70]["severity"] == "warning"
    assert '85%' in itens[70]["message"]
    assert itens[70]["read"] is False
    assert itens[100]["severity"] == "destructive"
    assert itens[100]["exceeded"] is True
    assert "estourou" in itens[100]["message"]
    assert itens[100]["category_name"] == "Alimentacao"


@pytest.mark.asyncio
async def test_marcar_uma_como_lida(notif_client):
    client, session = notif_client
    from app.db.models.category import CategoryORM

    cat = CategoryORM(id=10, name="Alimentacao", entity_type="individual", limit=1000.0, user_id=1)
    session.add(cat)
    await session.flush()
    repo = LimitAlertRepository(session)
    a1 = await repo.create(user_id=1, category_id=10, month="2026-09", threshold=70,
                           exceeded=False, percent_used=85.0)
    await session.commit()

    resp = await client.put(f"/notifications/{a1.id}/read")
    assert resp.status_code == 200
    assert resp.json()["success"] is True

    data = (await client.get("/notifications/")).json()
    assert data["unread_count"] == 0
    assert data["items"][0]["read"] is True


@pytest.mark.asyncio
async def test_marcar_todas_como_lidas(notif_client):
    client, session = notif_client
    from app.db.models.category import CategoryORM

    cat = CategoryORM(id=10, name="Alimentacao", entity_type="individual", limit=1000.0, user_id=1)
    session.add(cat)
    await session.flush()
    repo = LimitAlertRepository(session)
    await repo.create(user_id=1, category_id=10, month="2026-09", threshold=70,
                      exceeded=False, percent_used=85.0)
    await repo.create(user_id=1, category_id=10, month="2026-09", threshold=80,
                      exceeded=False, percent_used=85.0)
    await session.commit()

    resp = await client.put("/notifications/read-all")
    assert resp.status_code == 200
    assert resp.json()["updated"] == 2

    data = (await client.get("/notifications/")).json()
    assert data["unread_count"] == 0


@pytest.mark.asyncio
async def test_risk_check_categoria_estourada(notif_client):
    client, session = notif_client
    cats = await client.post("/categories/", json={
        "category_name": "Alimentacao",
        "entity_type": "individual",
        "limit": 1000.0,
        "subcategories": [{"subcategory_name": "Supermercado"}],
    })
    assert cats.status_code == 201
    cat_id = cats.json()["id"]

    opts = await client.get("/dashboard/category-options")
    opt = next(c for c in opts.json()["options"] if c["name"] == "Alimentacao")
    sub_id = opt["subcategories"][0]["id"]

    tx = await client.post("/transacoes/", json={
        "amount": 1050.0,
        "description": "Compras",
        "transaction_date": "2026-09-15T10:00:00",
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_id": cat_id,
        "subcategory_id": sub_id,
    })
    assert tx.status_code == 201

    resp = await client.get(f"/limits/risk-check?category_id={cat_id}")
    assert resp.status_code == 200
    data = resp.json()
    assert data["is_over_limit"] is True
    assert data["percent_used"] == 105.0


@pytest.mark.asyncio
async def test_risk_check_categoria_ok(notif_client):
    client, session = notif_client
    cats = await client.post("/categories/", json={
        "category_name": "Alimentacao",
        "entity_type": "individual",
        "limit": 1000.0,
        "subcategories": [{"subcategory_name": "Supermercado"}],
    })
    cat_id = cats.json()["id"]

    resp = await client.get(f"/limits/risk-check?category_id={cat_id}")
    assert resp.status_code == 200
    assert resp.json()["is_over_limit"] is False


@pytest.mark.asyncio
async def test_criar_transacao_estourada_dispara_notificacao(notif_client):
    """Etapa 5: pós-mutação dispara a avaliação automaticamente."""
    client, session = notif_client
    cats = await client.post("/categories/", json={
        "category_name": "Alimentacao",
        "entity_type": "individual",
        "limit": 1000.0,
        "subcategories": [{"subcategory_name": "Supermercado"}],
    })
    cat_id = cats.json()["id"]

    opts = await client.get("/dashboard/category-options")
    opt = next(c for c in opts.json()["options"] if c["name"] == "Alimentacao")
    sub_id = opt["subcategories"][0]["id"]

    tx = await client.post("/transacoes/", json={
        "amount": 1050.0,
        "description": "Compras",
        "transaction_date": "2026-09-15T10:00:00",
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_id": cat_id,
        "subcategory_id": sub_id,
    })
    assert tx.status_code == 201

    data = (await client.get("/notifications/")).json()
    assert data["unread_count"] == 4
    thresholds = sorted(i["threshold"] for i in data["items"])
    assert thresholds == [70, 80, 90, 100]
    estourado = next(i for i in data["items"] if i["threshold"] == 100)
    assert estourado["severity"] == "destructive"
    assert estourado["exceeded"] is True

    # 2a transação no mesmo mês não duplica (idempotência)
    tx2 = await client.post("/transacoes/", json={
        "amount": 50.0,
        "description": "Mais compras",
        "transaction_date": "2026-09-16T10:00:00",
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_id": cat_id,
        "subcategory_id": sub_id,
    })
    assert tx2.status_code == 201
    data2 = (await client.get("/notifications/")).json()
    assert data2["unread_count"] == 4