import pytest


async def _setup_dashboard_data(client):
    cat, cat_id, sub_id = await _create_cat(client, "DashAlim")
    await client.post("/transacoes/", json={
        "valor": 100.0, "descricao": "Compras",
        "data_transacao": "2026-01-15T10:00:00",
        "tipo": "saida", "natureza": "pf", "forma_pagamento": "pix",
        "categoria_id": cat_id, "subcategoria_id": sub_id,
    })
    await client.post("/transacoes/", json={
        "valor": 3000.0, "descricao": "Salario",
        "data_transacao": "2026-01-01T00:00:00",
        "tipo": "entrada", "natureza": "pf", "forma_pagamento": "pix",
        "categoria_nome": "Renda", "subcategoria_nome": "Salario",
    })
    return cat_id, sub_id


async def _create_cat(client, nome):
    resp = await client.post("/categorias/", json={
        "categoria_nome": nome, "natureza": "pf", "limite": 1000.0,
        "subcategorias": [{"subcategoria_nome": "Sub1"}],
    })
    assert resp.status_code == 201
    cat = resp.json()
    opts = await client.get("/dashboard/opcoes-categorias")
    opt = next((c for c in opts.json()["opcoes"] if c["categoria"] == nome), None)
    sub_id = opt["subcategorias"][0]["id"] if opt and opt["subcategorias"] else None
    return cat, cat["id"], sub_id


@pytest.mark.asyncio
async def test_extrato_financeiro(client):
    await _setup_dashboard_data(client)
    response = await client.get("/dashboard/extrato?data_inicio=01/01/2026&data_final=31/01/2026&natureza=pf")
    assert response.status_code == 200
    data = response.json()
    assert "entradas" in data
    assert "saidas" in data
    assert "transacoes" in data


@pytest.mark.asyncio
async def test_rendimento_periodo(client):
    await _setup_dashboard_data(client)
    response = await client.get("/dashboard/rendimento-periodo?ano=2026&natureza=pf")
    assert response.status_code == 200
    data = response.json()
    assert "meses" in data


@pytest.mark.asyncio
async def test_gastos_por_categoria(client):
    await _setup_dashboard_data(client)
    response = await client.get("/dashboard/gastos-por-categoria?data_inicio=01/01/2026&data_final=31/01/2026&natureza=pf&tipo=saida")
    assert response.status_code == 200
    data = response.json()
    assert "categorias" in data


@pytest.mark.asyncio
async def test_opcoes_categorias(client):
    await _create_cat(client, "DashOpts")
    response = await client.get("/dashboard/opcoes-categorias?natureza=pf")
    assert response.status_code == 200
    data = response.json()
    assert "opcoes" in data
    assert len(data["opcoes"]) >= 1


@pytest.mark.asyncio
async def test_opcoes_categorias_all_natureza(client):
    await _create_cat(client, "DashAll")
    response = await client.get("/dashboard/opcoes-categorias?natureza=all")
    assert response.status_code == 200
    data = response.json()
    assert "opcoes" in data


@pytest.mark.asyncio
async def test_entradas_por_categoria(client):
    await _setup_dashboard_data(client)
    response = await client.get("/dashboard/entradas-por-categoria?data_inicio=01/01/2026&data_final=31/01/2026&natureza=pf")
    assert response.status_code == 200
    data = response.json()
    assert "subcategorias" in data


@pytest.mark.asyncio
async def test_extrato_invalid_date_format(client):
    response = await client.get("/dashboard/extrato?data_inicio=invalid&data_final=31/01/2026&natureza=pf")
    assert response.status_code == 400
