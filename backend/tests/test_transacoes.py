import pytest
from httpx import AsyncClient


async def create_categoria_with_sub(client, nome, natureza="pf", limite=1000.0, subs=None):
    payload = {
        "categoria_nome": nome,
        "natureza": natureza,
        "limite": limite,
        "subcategorias": subs or [{"subcategoria_nome": "Sub1"}],
    }
    resp = await client.post("/categorias/", json=payload)
    assert resp.status_code == 201
    cat = resp.json()
    opts = await client.get("/dashboard/opcoes-categorias")
    opt = next((c for c in opts.json()["opcoes"] if c["categoria"] == nome), None)
    sub_id = opt["subcategorias"][0]["id"] if opt and opt["subcategorias"] else None
    return cat, cat["id"], sub_id


@pytest.mark.asyncio
async def test_create_transacao_with_existing_categoria(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Alimentacao")
    payload = {
        "valor": 50.0,
        "descricao": "Compras",
        "data_transacao": "2026-01-15T10:00:00",
        "tipo": "saida",
        "natureza": "pf",
        "forma_pagamento": "pix",
        "categoria_id": cat_id,
        "subcategoria_id": sub_id,
    }
    response = await client.post("/transacoes/", json=payload)
    assert response.status_code == 201
    assert response.json()["valor"] == 50.0


@pytest.mark.asyncio
async def test_create_transacao_with_new_categoria_by_name(client):
    payload = {
        "valor": 100.0,
        "descricao": "Salario",
        "data_transacao": "2026-01-01T00:00:00",
        "tipo": "entrada",
        "natureza": "pf",
        "forma_pagamento": "pix",
        "categoria_nome": "Salario",
        "subcategoria_nome": "Mensal",
    }
    response = await client.post("/transacoes/", json=payload)
    assert response.status_code == 201
    assert response.json()["categoria_nome"] == "Salario"


@pytest.mark.asyncio
async def test_create_transacao_invalid_categoria(client):
    payload = {
        "valor": 50.0,
        "descricao": "Test",
        "data_transacao": "2026-01-15T10:00:00",
        "tipo": "saida",
        "natureza": "pf",
        "forma_pagamento": "pix",
        "categoria_id": 99999,
        "subcategoria_id": 99999,
    }
    response = await client.post("/transacoes/", json=payload)
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_list_transacoes(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Transporte")
    await client.post("/transacoes/", json={
        "valor": 25.0,
        "descricao": "Corrida",
        "data_transacao": "2026-01-10T15:00:00",
        "tipo": "saida",
        "natureza": "pf",
        "forma_pagamento": "pix",
        "categoria_id": cat_id,
        "subcategoria_id": sub_id,
    })
    response = await client.get("/transacoes/")
    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.asyncio
async def test_list_transacoes_with_date_filter(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Alimentacao2")
    await client.post("/transacoes/", json={
        "valor": 50.0,
        "descricao": "Compras",
        "data_transacao": "2026-01-15T10:00:00",
        "tipo": "saida",
        "natureza": "pf",
        "forma_pagamento": "pix",
        "categoria_id": cat_id,
        "subcategoria_id": sub_id,
    })
    response = await client.get("/transacoes/?data_inicio=01/01/2026&data_final=31/01/2026")
    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.asyncio
async def test_get_transacao_by_id(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Lazer")
    create = await client.post("/transacoes/", json={
        "valor": 30.0,
        "descricao": "Filme",
        "data_transacao": "2026-01-20T20:00:00",
        "tipo": "saida",
        "natureza": "pf",
        "forma_pagamento": "pix",
        "categoria_id": cat_id,
        "subcategoria_id": sub_id,
    })
    tx_id = create.json()["id"]
    response = await client.get(f"/transacoes/{tx_id}")
    assert response.status_code == 200
    assert response.json()["descricao"] == "Filme"


@pytest.mark.asyncio
async def test_get_transacao_not_found(client):
    response = await client.get("/transacoes/999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_transacao(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Saude")
    create = await client.post("/transacoes/", json={
        "valor": 40.0,
        "descricao": "Remedio",
        "data_transacao": "2026-01-25T09:00:00",
        "tipo": "saida",
        "natureza": "pf",
        "forma_pagamento": "pix",
        "categoria_id": cat_id,
        "subcategoria_id": sub_id,
    })
    tx_id = create.json()["id"]
    response = await client.put(f"/transacoes/{tx_id}", json={
        "valor": 60.0,
        "descricao": "Remedio Atualizado",
    })
    assert response.status_code == 200
    assert response.json()["valor"] == 60.0


@pytest.mark.asyncio
async def test_update_transacao_not_found(client):
    response = await client.put("/transacoes/999", json={"valor": 10.0})
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_delete_transacao(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Educacao")
    create = await client.post("/transacoes/", json={
        "valor": 80.0,
        "descricao": "Livro",
        "data_transacao": "2026-01-30T14:00:00",
        "tipo": "saida",
        "natureza": "pf",
        "forma_pagamento": "pix",
        "categoria_id": cat_id,
        "subcategoria_id": sub_id,
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
