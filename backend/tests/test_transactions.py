import pytest
from httpx import AsyncClient


async def create_categoria_with_sub(client, nome, entity_type="individual", limit=1000.0, subs=None):
    payload = {
        "category_name": nome,
        "entity_type": entity_type,
        "limit": limit,
        "subcategories": subs or [{"subcategory_name": "Sub1"}],
    }
    resp = await client.post("/categories/", json=payload)
    assert resp.status_code == 201
    cat = resp.json()
    opts = await client.get("/dashboard/category-options")
    opt = next((c for c in opts.json()["options"] if c["name"] == nome), None)
    sub_id = opt["subcategories"][0]["id"] if opt and opt["subcategories"] else None
    return cat, cat["id"], sub_id


@pytest.mark.asyncio
async def test_create_transacao_with_existing_categoria(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Alimentacao")
    payload = {
        "amount": 50.0,
        "description": "Compras",
        "transaction_date": "2026-01-15T10:00:00",
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_id": cat_id,
        "subcategory_id": sub_id,
    }
    response = await client.post("/transacoes/", json=payload)
    assert response.status_code == 201
    assert response.json()["amount"] == 50.0


@pytest.mark.asyncio
async def test_create_transacao_with_new_categoria_by_name(client):
    payload = {
        "amount": 100.0,
        "description": "Salario",
        "transaction_date": "2026-01-01T00:00:00",
        "type": "income",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_name": "Salario",
        "subcategory_name": "Mensal",
    }
    response = await client.post("/transacoes/", json=payload)
    assert response.status_code == 201
    assert response.json()["category_name"] == "Salario"


@pytest.mark.asyncio
async def test_create_transacao_invalid_categoria(client):
    payload = {
        "amount": 50.0,
        "description": "Test",
        "transaction_date": "2026-01-15T10:00:00",
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_id": 99999,
        "subcategory_id": 99999,
    }
    response = await client.post("/transacoes/", json=payload)
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_transacoes(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Transporte")
    await client.post("/transacoes/", json={
        "amount": 25.0,
        "description": "Corrida",
        "transaction_date": "2026-01-10T15:00:00",
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_id": cat_id,
        "subcategory_id": sub_id,
    })
    response = await client.get("/transacoes/")
    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.asyncio
async def test_list_transacoes_with_date_filter(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Alimentacao2")
    await client.post("/transacoes/", json={
        "amount": 50.0,
        "description": "Compras",
        "transaction_date": "2026-01-15T10:00:00",
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_id": cat_id,
        "subcategory_id": sub_id,
    })
    response = await client.get("/transacoes/?start_date=01/01/2026&end_date=31/01/2026")
    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.asyncio
async def test_get_transacao_by_id(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Lazer")
    create = await client.post("/transacoes/", json={
        "amount": 30.0,
        "description": "Filme",
        "transaction_date": "2026-01-20T20:00:00",
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_id": cat_id,
        "subcategory_id": sub_id,
    })
    tx_id = create.json()["id"]
    response = await client.get(f"/transacoes/{tx_id}")
    assert response.status_code == 200
    assert response.json()["description"] == "Filme"


@pytest.mark.asyncio
async def test_get_transacao_not_found(client):
    response = await client.get("/transacoes/999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_transacao(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Saude")
    create = await client.post("/transacoes/", json={
        "amount": 40.0,
        "description": "Remedio",
        "transaction_date": "2026-01-25T09:00:00",
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_id": cat_id,
        "subcategory_id": sub_id,
    })
    tx_id = create.json()["id"]
    response = await client.put(f"/transacoes/{tx_id}", json={
        "amount": 60.0,
        "description": "Remedio Atualizado",
    })
    assert response.status_code == 200
    assert response.json()["amount"] == 60.0


@pytest.mark.asyncio
async def test_update_transacao_not_found(client):
    response = await client.put("/transacoes/999", json={"amount": 10.0})
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_transacao(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Educacao")
    create = await client.post("/transacoes/", json={
        "amount": 80.0,
        "description": "Livro",
        "transaction_date": "2026-01-30T14:00:00",
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_id": cat_id,
        "subcategory_id": sub_id,
    })
    tx_id = create.json()["id"]
    response = await client.delete(f"/transacoes/{tx_id}")
    assert response.status_code == 200
    get_response = await client.get(f"/transacoes/{tx_id}")
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_delete_transacao_not_found(client):
    response = await client.delete("/transacoes/999")
    assert response.status_code == 404
