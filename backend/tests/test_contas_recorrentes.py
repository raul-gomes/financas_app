import pytest
from httpx import AsyncClient


async def create_categoria_with_sub(client, nome, natureza="pf", limite=1000.0):
    payload = {
        "categoria_nome": nome,
        "natureza": natureza,
        "limite": limite,
        "subcategorias": [{"subcategoria_nome": "Sub1"}],
    }
    resp = await client.post("/categorias/", json=payload)
    assert resp.status_code == 201
    cat = resp.json()
    opts = await client.get("/dashboard/opcoes-categorias")
    opt = next((c for c in opts.json()["opcoes"] if c["categoria"] == nome), None)
    sub_id = opt["subcategorias"][0]["id"] if opt and opt["subcategorias"] else None
    return cat, cat["id"], sub_id


@pytest.mark.asyncio
async def test_create_conta_recorrente(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Moradia")
    payload = {
        "descricao": "Aluguel",
        "valor": 1500.0,
        "dia_vencimento": 10,
        "categoria_id": cat_id,
        "subcategoria_id": sub_id,
        "natureza": "pf",
        "forma_pagamento": "pix",
        "data_inicio": "2026-01-01T00:00:00",
        "ativo": True,
    }
    response = await client.post("/recorrentes/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["descricao"] == "Aluguel"
    assert data["valor"] == 1500.0


@pytest.mark.asyncio
async def test_list_contas_recorrentes(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Conta1")
    await client.post("/recorrentes/", json={
        "descricao": "Luz", "valor": 100.0, "dia_vencimento": 5,
        "categoria_id": cat_id, "subcategoria_id": sub_id,
        "natureza": "pf", "forma_pagamento": "boleto",
        "data_inicio": "2026-01-01T00:00:00",
    })
    response = await client.get("/recorrentes/")
    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.asyncio
async def test_get_conta_recorrente_by_id(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Conta2")
    create = await client.post("/recorrentes/", json={
        "descricao": "Agua", "valor": 80.0, "dia_vencimento": 15,
        "categoria_id": cat_id, "subcategoria_id": sub_id,
        "natureza": "pf", "forma_pagamento": "pix",
        "data_inicio": "2026-02-01T00:00:00",
    })
    conta_id = create.json()["id"]
    response = await client.get(f"/recorrentes/{conta_id}")
    assert response.status_code == 200
    assert response.json()["descricao"] == "Agua"


@pytest.mark.asyncio
async def test_get_conta_recorrente_not_found(client):
    response = await client.get("/recorrentes/999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_conta_recorrente_toggle_ativo(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Conta3")
    create = await client.post("/recorrentes/", json={
        "descricao": "Internet", "valor": 120.0, "dia_vencimento": 20,
        "categoria_id": cat_id, "subcategoria_id": sub_id,
        "natureza": "pf", "forma_pagamento": "pix",
        "data_inicio": "2026-01-01T00:00:00",
    })
    conta_id = create.json()["id"]
    response = await client.put(f"/recorrentes/{conta_id}", json={"ativo": False})
    assert response.status_code == 200
    assert response.json()["ativo"] is False


@pytest.mark.asyncio
async def test_update_conta_recorrente_valor(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Conta4")
    create = await client.post("/recorrentes/", json={
        "descricao": "Telefone", "valor": 50.0, "dia_vencimento": 25,
        "categoria_id": cat_id, "subcategoria_id": sub_id,
        "natureza": "pf", "forma_pagamento": "pix",
        "data_inicio": "2026-01-01T00:00:00",
    })
    conta_id = create.json()["id"]
    response = await client.put(f"/recorrentes/{conta_id}", json={"valor": 75.0})
    assert response.status_code == 200
    assert response.json()["valor"] == 75.0


@pytest.mark.asyncio
async def test_delete_conta_recorrente(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Conta5")
    create = await client.post("/recorrentes/", json={
        "descricao": "Streaming", "valor": 30.0, "dia_vencimento": 1,
        "categoria_id": cat_id, "subcategoria_id": sub_id,
        "natureza": "pf", "forma_pagamento": "credito",
        "data_inicio": "2026-01-01T00:00:00",
    })
    conta_id = create.json()["id"]
    response = await client.delete(f"/recorrentes/{conta_id}")
    assert response.status_code == 200
    assert response.json()["id"] == conta_id
    get_resp = await client.get(f"/recorrentes/{conta_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_conta_recorrente_not_found(client):
    response = await client.delete("/recorrentes/999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_generate_pending_transactions(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Conta6")
    await client.post("/recorrentes/", json={
        "descricao": "Gas", "valor": 60.0, "dia_vencimento": 10,
        "categoria_id": cat_id, "subcategoria_id": sub_id,
        "natureza": "pf", "forma_pagamento": "pix",
        "data_inicio": "2025-01-01T00:00:00",
    })
    response = await client.post("/recorrentes/generate", json={
        "data_inicio": "2026-01-01T00:00:00",
        "data_final": "2026-03-31T00:00:00",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["geradas"] >= 0
