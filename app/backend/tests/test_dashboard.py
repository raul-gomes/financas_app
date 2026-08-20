import pytest


async def _setup_dashboard_data(client):
    cat, cat_id, sub_id = await _create_cat(client, "DashAlim")
    await client.post("/transacoes/", json={
        "amount": 100.0, "description": "Compras",
        "transaction_date": "2026-01-15T10:00:00",
        "type": "expense", "entity_type": "individual", "payment_method": "pix",
        "category_id": cat_id, "subcategory_id": sub_id,
    })
    await client.post("/transacoes/", json={
        "amount": 3000.0, "description": "Salario",
        "transaction_date": "2026-01-01T00:00:00",
        "type": "income", "entity_type": "individual", "payment_method": "pix",
        "category_name": "Renda", "subcategory_name": "Salario",
    })
    return cat_id, sub_id


async def _create_cat(client, nome):
    resp = await client.post("/categories/", json={
        "category_name": nome, "entity_type": "individual", "limit": 1000.0,
        "subcategories": [{"subcategory_name": "Sub1"}],
    })
    assert resp.status_code == 201
    cat = resp.json()
    opts = await client.get("/dashboard/category-options")
    opt = next((c for c in opts.json()["options"] if c["name"] == nome), None)
    sub_id = opt["subcategories"][0]["id"] if opt and opt["subcategories"] else None
    return cat, cat["id"], sub_id


@pytest.mark.asyncio
async def test_extrato_financeiro(client):
    await _setup_dashboard_data(client)
    response = await client.get("/dashboard/statement?start_date=01/01/2026&end_date=31/01/2026&entity_type=individual")
    assert response.status_code == 200
    data = response.json()
    assert "total_income" in data
    assert "total_expenses" in data
    assert "transactions" in data


@pytest.mark.asyncio
async def test_rendimento_periodo(client):
    await _setup_dashboard_data(client)
    response = await client.get("/dashboard/period-income?year=2026&entity_type=individual")
    assert response.status_code == 200
    data = response.json()
    assert "months" in data


@pytest.mark.asyncio
async def test_gastos_por_categoria(client):
    await _setup_dashboard_data(client)
    response = await client.get("/dashboard/expenses-by-category?start_date=01/01/2026&end_date=31/01/2026&entity_type=individual&type=expense")
    assert response.status_code == 200
    data = response.json()
    assert "categories" in data


@pytest.mark.asyncio
async def test_opcoes_categorias(client):
    await _create_cat(client, "DashOpts")
    response = await client.get("/dashboard/category-options?entity_type=individual")
    assert response.status_code == 200
    data = response.json()
    assert "options" in data
    assert len(data["options"]) >= 1


@pytest.mark.asyncio
async def test_opcoes_categorias_all_natureza(client):
    await _create_cat(client, "DashAll")
    response = await client.get("/dashboard/category-options?entity_type=all")
    assert response.status_code == 200
    data = response.json()
    assert "options" in data


@pytest.mark.asyncio
async def test_entradas_por_categoria(client):
    await _setup_dashboard_data(client)
    response = await client.get("/dashboard/income-by-category?start_date=01/01/2026&end_date=31/01/2026&entity_type=individual")
    assert response.status_code == 200
    data = response.json()
    assert "subcategories" in data


@pytest.mark.asyncio
async def test_extrato_invalid_date_format(client):
    response = await client.get("/dashboard/statement?start_date=invalid&end_date=31/01/2026&entity_type=individual")
    assert response.status_code == 400
