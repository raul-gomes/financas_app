import pytest


@pytest.mark.asyncio
async def test_create_meta(client):
    """Cria uma meta e verifica se retorna os dados corretos."""
    response = await client.post("/metas/", json={
        "subcategoria_nome": "Viagem Europa",
        "valor_alvo": 30000,
    })
    assert response.status_code == 201
    data = response.json()
    assert data["subcategoria_nome"] == "Viagem Europa"
    assert data["valor_alvo"] == 30000
    assert "id" in data


@pytest.mark.asyncio
async def test_list_metas(client):
    """Lista metas e verifica se retorna a lista correta."""
    # Cria duas metas
    await client.post("/metas/", json={"subcategoria_nome": "Meta 1", "valor_alvo": 1000})
    await client.post("/metas/", json={"subcategoria_nome": "Meta 2", "valor_alvo": 2000})

    response = await client.get("/metas/")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_update_meta(client):
    """Atualiza uma meta e verifica os novos valores."""
    resp = await client.post("/metas/", json={"subcategoria_nome": "Meta Original", "valor_alvo": 5000})
    meta_id = resp.json()["id"]

    response = await client.put(f"/metas/{meta_id}", json={
        "subcategoria_nome": "Meta Atualizada",
        "valor_alvo": 8000,
    })
    assert response.status_code == 200
    data = response.json()
    assert data["subcategoria_nome"] == "Meta Atualizada"
    assert data["valor_alvo"] == 8000


@pytest.mark.asyncio
async def test_delete_meta(client):
    """Exclui uma meta e verifica que não está mais na lista."""
    resp = await client.post("/metas/", json={"subcategoria_nome": "Meta para Deletar", "valor_alvo": 1000})
    meta_id = resp.json()["id"]

    response = await client.delete(f"/metas/{meta_id}")
    assert response.status_code == 200

    # Verifica que foi removida
    list_resp = await client.get("/metas/")
    ids = [m["id"] for m in list_resp.json()]
    assert meta_id not in ids


@pytest.mark.asyncio
async def test_progresso_sem_transacoes(client):
    """Progresso de meta sem transações deve ser 0."""
    resp = await client.post("/metas/", json={"subcategoria_nome": "Meta", "valor_alvo": 1000})
    meta_id = resp.json()["id"]

    response = await client.get(f"/metas/progresso?ano=2026&mes=6")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    meta_progresso = next(m for m in data if m["subcategoria_id"] == meta_id)
    assert meta_progresso["valor_atual"] == 0
    assert meta_progresso["progresso"] == 0


@pytest.mark.asyncio
async def test_progresso_com_transacoes(client):
    """Progresso de meta deve refletir transações da subcategoria no mês."""
    # Cria meta (cria subcategoria "Economizar" na categoria "Metas")
    resp = await client.post("/metas/", json={"subcategoria_nome": "Economizar", "valor_alvo": 5000})
    meta = resp.json()
    sub_id = meta["id"]

    # Busca a categoria "Metas" para pegar o categoria_id
    metas_resp = await client.get("/categorias/")
    categorias = metas_resp.json()
    metas_cat = next(c for c in categorias if c["categoria_nome"] == "Metas")

    # Cria transação com valor 1000 na subcategoria da meta
    await client.post("/transacoes/", json={
        "valor": 1000,
        "descricao": "Depósito economia",
        "data_transacao": "2026-06-15T10:00:00",
        "tipo": "entrada",
        "natureza": "pf",
        "forma_pagamento": "pix",
        "categoria_id": metas_cat["id"],
        "subcategoria_id": sub_id,
    })

    # Verifica progresso
    response = await client.get("/metas/progresso?ano=2026&mes=6")
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    meta_progresso = next(m for m in data if m["subcategoria_id"] == sub_id)
    assert meta_progresso["valor_atual"] == 1000
    assert meta_progresso["progresso"] == 20.0  # 1000/5000 * 100


@pytest.mark.asyncio
async def test_meta_duplicada(client):
    """Criar meta com nome duplicado deve retornar 409."""
    await client.post("/metas/", json={"subcategoria_nome": "Unica", "valor_alvo": 1000})
    response = await client.post("/metas/", json={"subcategoria_nome": "Unica", "valor_alvo": 2000})
    assert response.status_code == 409
