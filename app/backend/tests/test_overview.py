import pytest


async def _create_cat(client, nome, entidade="individual", limite=1000.0):
    resp = await client.post(
        "/categories/",
        json={
            "category_name": nome,
            "entity_type": entidade,
            "limit": limite,
            "subcategories": [{"subcategory_name": "Sub" + nome}],
        },
    )
    assert resp.status_code == 201
    opts = await client.get("/dashboard/category-options")
    opt = next((c for c in opts.json()["options"] if c["name"] == nome), None)
    sub_id = opt["subcategories"][0]["id"] if opt and opt["subcategories"] else None
    return resp.json()["id"], sub_id


async def _add_tx(
    client,
    amount,
    tipo,
    entidade,
    sub_id,
    cat_id,
    method="pix",
    day="2026-09-10T10:00:00",
    installment=None,
    total=None,
    is_installment=False,
):
    payload = {
        "amount": amount,
        "description": f"Tx {amount}",
        "transaction_date": day,
        "type": tipo,
        "entity_type": entidade,
        "payment_method": method,
        "category_id": cat_id,
        "category_name": None,
        "subcategory_id": sub_id,
        "subcategory_name": None,
        "installment_number": installment,
        "total_installments": total,
        "is_installment": is_installment,
    }
    resp = await client.post("/transacoes/", json=payload)
    assert resp.status_code == 201, resp.text


@pytest.mark.asyncio
async def test_overview_totals_receitas_despesas_investimentos(client):
    cat_id, sub_id = await _create_cat(client, "Alim", "individual", 1000.0)
    await _add_tx(client, 3000.0, "income", "individual", sub_id, cat_id)
    await _add_tx(client, 800.0, "expense", "individual", sub_id, cat_id)
    await _add_tx(client, 200.0, "investment", "individual", sub_id, cat_id)

    resp = await client.get("/dashboard/overview?year=2026&month=9&entity_type=all")
    assert resp.status_code == 200
    data = resp.json()

    assert data["totals"]["total_income"] == pytest.approx(3000.0)
    assert data["totals"]["total_expenses"] == pytest.approx(800.0)
    assert data["totals"]["total_invested"] == pytest.approx(200.0)
    assert data["totals"]["balance"] == pytest.approx(2200.0)


@pytest.mark.asyncio
async def test_overview_filtra_por_entity_type(client):
    pf_cat, pf_sub = await _create_cat(client, "PF", "individual", 1000.0)
    pj_cat, pj_sub = await _create_cat(client, "PJ", "business", 2000.0)
    await _add_tx(client, 1500.0, "expense", "individual", pf_sub, pf_cat)
    await _add_tx(client, 900.0, "expense", "business", pj_sub, pj_cat)

    resp_pf = await client.get("/dashboard/overview?year=2026&month=9&entity_type=individual")
    assert resp_pf.json()["totals"]["total_expenses"] == pytest.approx(1500.0)

    resp_pj = await client.get("/dashboard/overview?year=2026&month=9&entity_type=business")
    assert resp_pj.json()["totals"]["total_expenses"] == pytest.approx(900.0)

    resp_all = await client.get("/dashboard/overview?year=2026&month=9&entity_type=all")
    assert resp_all.json()["totals"]["total_expenses"] == pytest.approx(2400.0)


@pytest.mark.asyncio
async def test_overview_categorias_status_somente_proximas_ou_estouradas(client):
    """Dashboard só lista categorias estouradas ou quase (>=80% do limite)."""
    safe_cat, safe_sub = await _create_cat(client, "Transporte", "individual", 1000.0)
    warn_cat, warn_sub = await _create_cat(client, "Lazer", "individual", 1000.0)
    over_cat, over_sub = await _create_cat(client, "Compras", "individual", 1000.0)

    await _add_tx(client, 400.0, "expense", "individual", safe_sub, safe_cat)  # 40% -> fora
    await _add_tx(client, 900.0, "expense", "individual", warn_sub, warn_cat)  # 90% -> warning
    await _add_tx(client, 1200.0, "expense", "individual", over_sub, over_cat)  # 120% -> over

    resp = await client.get("/dashboard/overview?year=2026&month=9&entity_type=individual")
    status = {s["category_name"]: s["status"] for s in resp.json()["categories_status"]}

    assert "Transporte" not in status
    assert status["Lazer"] == "warning"
    assert status["Compras"] == "over"


@pytest.mark.asyncio
async def test_overview_categorias_status_limiar_80(client):
    """Categoria com exatos 80% deve aparecer (limiar inclusivo)."""
    cat_id, sub_id = await _create_cat(client, "Alim", "individual", 1000.0)
    await _add_tx(client, 800.0, "expense", "individual", sub_id, cat_id)  # 80%

    resp = await client.get("/dashboard/overview?year=2026&month=9&entity_type=individual")
    status = {s["category_name"]: s["status"] for s in resp.json()["categories_status"]}

    assert status["Alim"] == "warning"


@pytest.mark.asyncio
async def test_overview_parcelas_do_mes(client):
    cat_id, sub_id = await _create_cat(client, "Eletro", "individual", 1000.0)
    # Parcelada: 1/10 de 5000
    await _add_tx(
        client,
        500.0,
        "expense",
        "individual",
        sub_id,
        cat_id,
        method="credit",
        installment=1,
        total=10,
        is_installment=True,
    )
    # À vista não entra em parcelas
    await _add_tx(client, 60.0, "expense", "individual", sub_id, cat_id)

    resp = await client.get("/dashboard/overview?year=2026&month=9&entity_type=all")
    parcels = resp.json()["installments"]
    assert len(parcels) == 1
    assert parcels[0]["installment_number"] == 1
    assert parcels[0]["total_installments"] == 10


@pytest.mark.asyncio
async def test_overview_credito_usado_vs_limite(client):
    # Cria categoria especial de limite de cartão
    await client.post(
        "/categories/",
        json={
            "category_name": "Limite Cartao Credito",
            "entity_type": "individual",
            "limit": 10000.0,
            "subcategories": [],
        },
    )
    cat_id, sub_id = await _create_cat(client, "ComprasCartao", "individual", 1000.0)
    await _add_tx(client, 3000.0, "expense", "individual", sub_id, cat_id, method="credit")
    await _add_tx(client, 500.0, "expense", "individual", sub_id, cat_id, method="pix")

    resp = await client.get("/dashboard/overview?year=2026&month=9&entity_type=individual")
    cred = resp.json()["credit_card"]
    assert cred["limit"] == pytest.approx(10000.0)
    assert cred["used"] == pytest.approx(3000.0)
    assert cred["percent_used"] == pytest.approx(30.0, rel=0.1)
    assert cred["remaining"] == pytest.approx(7000.0)


@pytest.mark.asyncio
async def test_overview_recorrentes_e_parcelas_futuras(client):
    await client.post("/goals/", json={"subcategory_name": "MetaX", "target_amount": 5000})

    # Cria conta recorrente manualmente
    cats = await client.get("/dashboard/category-options?entity_type=individual")
    opts = [o for o in cats.json()["options"] if o["name"] != "Limite Cartao Credito"]
    opt = opts[0]
    sub_id = opt["subcategories"][0]["id"]
    cr = await client.post(
        "/recurring-accounts/",
        json={
            "description": "Assinatura Netflix",
            "amount": 50.0,
            "due_day": 5,
            "category_id": opt["id"],
            "subcategory_id": sub_id,
            "entity_type": "individual",
            "payment_method": "pix",
            "start_date": "2026-01-01T00:00:00",
        },
    )
    assert cr.status_code == 201, cr.text

    ov = await client.get("/dashboard/overview?year=2026&month=9&entity_type=all")
    recs = ov.json()["recurring_accounts"]
    assert any(r["description"] == "Assinatura Netflix" for r in recs)
    assert any(r["current_installment"] >= 1 for r in recs)


@pytest.mark.asyncio
async def test_overview_metas_e_compras_somente_admin(clients_ctrl):
    # Como admin (user 1): metas e compras populadas
    await clients_ctrl.post(
        "/goals/", json={"subcategory_name": "Meta Eurotrip", "target_amount": 50000}
    )
    await clients_ctrl.post(
        "/shopping/", json={"name": "Notebook", "reference_month": "2026-09-01"}
    )

    resp = await clients_ctrl.get("/dashboard/overview?year=2026&month=9&entity_type=all")
    data = resp.json()
    assert len(data["goals"]) == 1
    assert data["goals"][0]["subcategory_name"] == "Meta Eurotrip"
    assert len(data["shopping"]) == 1
    assert data["shopping"][0]["name"] == "Notebook"

    # Como user (role='user') → metas/compras vazias (não vaza dado admin-only)
    clients_ctrl.switch(3)
    resp_user = await clients_ctrl.get("/dashboard/overview?year=2026&month=9&entity_type=all")
    assert resp_user.status_code == 200
    data_user = resp_user.json()
    assert data_user["goals"] == []
    assert data_user["shopping"] == []


@pytest.mark.asyncio
async def test_overview_month_progress_current(client):
    cat_id, sub_id = await _create_cat(client, "Alim", "individual", 1000.0)
    await _add_tx(client, 100.0, "expense", "individual", sub_id, cat_id)

    resp = await client.get("/dashboard/overview?year=2026&month=9&entity_type=all")
    mp = resp.json()["month_progress"]
    assert mp["day"] >= 1
    assert mp["days_in_month"] == 30
    assert 0 <= mp["percent"] <= 1
    assert "income_up_to_today" in mp
    assert "expenses_up_to_today" in mp
