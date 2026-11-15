import pytest


async def _setup_dashboard_data(client):
    _cat, cat_id, sub_id = await _create_cat(client, "DashAlim")
    await client.post(
        "/transacoes/",
        json={
            "amount": 100.0,
            "description": "Compras",
            "transaction_date": "2026-01-15T10:00:00",
            "type": "expense",
            "entity_type": "individual",
            "payment_method": "pix",
            "category_id": cat_id,
            "subcategory_id": sub_id,
        },
    )
    await client.post(
        "/transacoes/",
        json={
            "amount": 3000.0,
            "description": "Salario",
            "transaction_date": "2026-01-01T00:00:00",
            "type": "income",
            "entity_type": "individual",
            "payment_method": "pix",
            "category_name": "Renda",
            "subcategory_name": "Salario",
        },
    )
    return cat_id, sub_id


async def _create_cat(client, nome):
    resp = await client.post(
        "/categories/",
        json={
            "category_name": nome,
            "entity_type": "individual",
            "limit": 1000.0,
            "subcategories": [{"subcategory_name": "Sub1"}],
        },
    )
    assert resp.status_code == 201
    cat = resp.json()
    opts = await client.get("/dashboard/category-options")
    opt = next((c for c in opts.json()["options"] if c["name"] == nome), None)
    sub_id = opt["subcategories"][0]["id"] if opt and opt["subcategories"] else None
    return cat, cat["id"], sub_id


@pytest.mark.asyncio
async def test_extrato_financeiro(client):
    await _setup_dashboard_data(client)
    response = await client.get(
        "/dashboard/statement?start_date=01/01/2026&end_date=31/01/2026&entity_type=individual"
    )
    assert response.status_code == 200
    data = response.json()
    assert "total_income" in data
    assert "total_expenses" in data
    assert "daily_totals" in data
    assert "transactions" not in data


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
    response = await client.get(
        "/dashboard/expenses-by-category?start_date=01/01/2026&end_date=31/01/2026&entity_type=individual&type=expense"
    )
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
async def test_opcoes_categorias_escondem_categorias_de_configuracao(client):
    # Categorias de configuração (orçamento mensal / limite do cartão) NÃO
    # podem aparecer como opções de categoria no dropdown de transação.
    for nome in ["Mensal PF", "Mensal PJ", "Limite Cartao Credito"]:
        resp = await client.post(
            "/categories/",
            json={
                "category_name": nome,
                "entity_type": "individual",
                "limit": 5000.0,
            },
        )
        assert resp.status_code == 201

    await _create_cat(client, "Moradia")

    response = await client.get("/dashboard/category-options?entity_type=individual")
    assert response.status_code == 200
    data = response.json()
    nomes = [c["name"] for c in data["options"]]

    assert "Moradia" in nomes
    assert "Mensal PF" not in nomes
    assert "Mensal PJ" not in nomes
    assert "Limite Cartao Credito" not in nomes


@pytest.mark.asyncio
async def test_entradas_por_categoria(client):
    await _setup_dashboard_data(client)
    response = await client.get(
        "/dashboard/income-by-category?start_date=01/01/2026&end_date=31/01/2026&entity_type=individual"
    )
    assert response.status_code == 200
    data = response.json()
    assert "subcategories" in data


@pytest.mark.asyncio
async def test_extrato_invalid_date_format(client):
    response = await client.get(
        "/dashboard/statement?start_date=invalid&end_date=31/01/2026&entity_type=individual"
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_dashboard_all_scope_includes_both_natures(client):
    """entity_type=all sums individual and business on every dashboard endpoint the page calls."""
    cat_id, sub_id = await _setup_dashboard_data(client)
    business = await client.post(
        "/transacoes/",
        json={
            "amount": 40.0,
            "description": "Software",
            "transaction_date": "2026-01-20T10:00:00",
            "type": "expense",
            "entity_type": "business",
            "payment_method": "pix",
            "category_id": cat_id,
            "subcategory_id": sub_id,
        },
    )
    assert business.status_code == 201
    period = "start_date=01/01/2026&end_date=31/01/2026"

    statements = {}
    for scope in ("individual", "business", "all"):
        response = await client.get(f"/dashboard/statement?{period}&entity_type={scope}")
        assert response.status_code == 200
        statements[scope] = response.json()

    assert statements["individual"]["total_expenses"] == 100.0
    assert statements["business"]["total_expenses"] == 40.0
    assert statements["all"]["total_expenses"] == 140.0
    assert statements["all"]["total_income"] == 3000.0

    yearly = await client.get("/dashboard/period-income?year=2026&entity_type=all")
    assert yearly.status_code == 200
    assert yearly.json()["months"]["january"]["expense"] == 140.0
    for path in ("expenses-by-category", "income-by-category"):
        extra = "&type=expense" if path == "expenses-by-category" else ""
        response = await client.get(f"/dashboard/{path}?{period}&entity_type=all{extra}")
        assert response.status_code == 200
