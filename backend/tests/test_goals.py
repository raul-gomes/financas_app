import pytest


@pytest.mark.asyncio
async def test_create_meta(client):
    """Cria uma meta e verifica se retorna os dados corretos."""
    response = await client.post("/goals/", json={
        "subcategory_name": "Viagem Europa",
        "target_amount": 30000,
    })
    assert response.status_code == 201
    data = response.json()
    assert data["subcategory_name"] == "Viagem Europa"
    assert data["target_amount"] == 30000
    assert "id" in data


@pytest.mark.asyncio
async def test_list_metas(client):
    """Lista metas e verifica se retorna a lista correta."""
    # Cria duas metas
    await client.post("/goals/", json={"subcategory_name": "Meta 1", "target_amount": 1000})
    await client.post("/goals/", json={"subcategory_name": "Meta 2", "target_amount": 2000})

    response = await client.get("/goals/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_update_meta(client):
    """Atualiza uma meta e verifica os novos valores."""
    resp = await client.post("/goals/", json={"subcategory_name": "Meta Original", "target_amount": 5000})
    meta_id = resp.json()["id"]

    response = await client.put(f"/goals/{meta_id}", json={
        "subcategory_name": "Meta Atualizada",
        "target_amount": 8000,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["subcategory_name"] == "Meta Atualizada"
    assert data["target_amount"] == 8000


@pytest.mark.asyncio
async def test_delete_meta(client):
    """Exclui uma meta e verifica que não está mais na lista."""
    resp = await client.post("/goals/", json={"subcategory_name": "Meta para Deletar", "target_amount": 1000})
    meta_id = resp.json()["id"]

    response = await client.delete(f"/goals/{meta_id}")
    assert response.status_code == 200

    # Verifica que foi removida
    list_resp = await client.get("/goals/")
    ids = [m["id"] for m in list_resp.json()]
    assert meta_id not in ids


@pytest.mark.asyncio
async def test_progresso_sem_transacoes(client):
    """Progresso de meta sem transações deve ser 0."""
    resp = await client.post("/goals/", json={"subcategory_name": "Meta", "target_amount": 1000})
    meta_id = resp.json()["id"]

    response = await client.get("/goals/progress?year=2026&month=6")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    meta_progresso = next(m for m in data if m["subcategory_id"] == meta_id)
    assert meta_progresso["current_amount"] == 0
    assert meta_progresso["progress"] == 0


@pytest.mark.asyncio
async def test_progresso_com_transacoes(client):
    """Progresso de meta deve refletir transações da subcategoria no mês."""
    # Cria meta (cria subcategoria "Economizar" na categoria "Metas")
    resp = await client.post("/goals/", json={"subcategory_name": "Economizar", "target_amount": 5000})
    meta = resp.json()
    sub_id = meta["id"]

    # Busca a categoria "Metas" para pegar o category_id
    metas_resp = await client.get("/categories/")
    categorias = metas_resp.json()
    metas_cat = next(c for c in categorias if c["category_name"] == "Metas")

    # Cria transação com valor 1000 na subcategoria da meta
    await client.post("/transacoes/", json={
        "amount": 1000,
        "description": "Depósito economia",
        "transaction_date": "2026-06-15T10:00:00",
        "type": "income",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_id": metas_cat["id"],
        "subcategory_id": sub_id,
    })

    # Verifica progresso
    response = await client.get("/goals/progress?year=2026&month=6")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    meta_progresso = next(m for m in data if m["subcategory_id"] == sub_id)
    assert meta_progresso["current_amount"] == 1000
    assert meta_progresso["progress"] == 20.0  # 1000/5000 * 100


@pytest.mark.asyncio
async def test_meta_duplicada(client):
    """Criar meta com nome duplicado deve retornar 409."""
    await client.post("/goals/", json={"subcategory_name": "Unica", "target_amount": 1000})
    response = await client.post("/goals/", json={"subcategory_name": "Unica", "target_amount": 2000})
    assert response.status_code == 409
