import pytest
from datetime import datetime
from httpx import AsyncClient


def _expected_remaining_2026(total: int = 12) -> int:
    """Parcelas de jan/2026..dez/2026 com data >= dia 1 do mês atual (mesma regra do repository)."""
    now = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    return sum(1 for i in range(total) if datetime(2026, 1 + i, 1) >= now)


async def create_categoria_with_sub(client, nome, entity_type="individual", limit=1000.0):
    payload = {
        "category_name": nome,
        "entity_type": entity_type,
        "limit": limit,
        "subcategories": [{"subcategory_name": "Sub1"}],
    }
    resp = await client.post("/categories/", json=payload)
    assert resp.status_code == 201
    cat = resp.json()
    opts = await client.get("/dashboard/category-options")
    opt = next((c for c in opts.json()["options"] if c["name"] == nome), None)
    sub_id = opt["subcategories"][0]["id"] if opt and opt["subcategories"] else None
    return cat, cat["id"], sub_id


@pytest.mark.asyncio
async def test_create_conta_recorrente(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Moradia")
    payload = {
        "description": "Aluguel",
        "amount": 1500.0,
        "due_day": 10,
        "category_id": cat_id,
        "subcategory_id": sub_id,
        "entity_type": "individual",
        "payment_method": "pix",
        "start_date": "2026-01-01T00:00:00",
        "active": True,
    }
    response = await client.post("/recurring-accounts/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["description"] == "Aluguel"
    assert data["amount"] == 1500.0
    assert data["total_installments"] == 12
    # Parcelas restantes = meses de 2026 a partir do mês corrente (inclui o mês atual)
    assert data["remaining_installments"] == _expected_remaining_2026()


@pytest.mark.asyncio
async def test_create_conta_recorrente_com_parcelas(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Moradia2")
    payload = {
        "description": "Condominio",
        "amount": 800.0,
        "due_day": 5,
        "category_id": cat_id,
        "subcategory_id": sub_id,
        "entity_type": "individual",
        "payment_method": "boleto",
        "start_date": "2026-01-01T00:00:00",
        "active": True,
        "total_installments": 12,
    }
    response = await client.post("/recurring-accounts/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["total_installments"] == 12
    assert data["remaining_installments"] == _expected_remaining_2026()


@pytest.mark.asyncio
async def test_list_contas_recorrentes(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Conta1")
    await client.post("/recurring-accounts/", json={
        "description": "Luz", "amount": 100.0, "due_day": 5,
        "category_id": cat_id, "subcategory_id": sub_id,
        "entity_type": "individual", "payment_method": "boleto",
        "start_date": "2026-01-01T00:00:00",
    })
    response = await client.get("/recurring-accounts/")
    assert response.status_code == 200
    assert len(response.json()) >= 1


@pytest.mark.asyncio
async def test_get_conta_recorrente_by_id(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Conta2")
    create = await client.post("/recurring-accounts/", json={
        "description": "Agua", "amount": 80.0, "due_day": 15,
        "category_id": cat_id, "subcategory_id": sub_id,
        "entity_type": "individual", "payment_method": "pix",
        "start_date": "2026-02-01T00:00:00",
    })
    conta_id = create.json()["id"]
    response = await client.get(f"/recurring-accounts/{conta_id}")
    assert response.status_code == 200
    assert response.json()["description"] == "Agua"


@pytest.mark.asyncio
async def test_get_conta_recorrente_not_found(client):
    response = await client.get("/recurring-accounts/999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_conta_recorrente_toggle_ativo(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Conta3")
    create = await client.post("/recurring-accounts/", json={
        "description": "Internet", "amount": 120.0, "due_day": 20,
        "category_id": cat_id, "subcategory_id": sub_id,
        "entity_type": "individual", "payment_method": "pix",
        "start_date": "2026-01-01T00:00:00",
    })
    conta_id = create.json()["id"]
    response = await client.put(f"/recurring-accounts/{conta_id}", json={"active": False})
    assert response.status_code == 200
    assert response.json()["active"] is False


@pytest.mark.asyncio
async def test_update_conta_recorrente_valor(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Conta4")
    create = await client.post("/recurring-accounts/", json={
        "description": "Telefone", "amount": 50.0, "due_day": 25,
        "category_id": cat_id, "subcategory_id": sub_id,
        "entity_type": "individual", "payment_method": "pix",
        "start_date": "2026-01-01T00:00:00",
    })
    conta_id = create.json()["id"]
    response = await client.put(f"/recurring-accounts/{conta_id}", json={"amount": 75.0})
    assert response.status_code == 200
    assert response.json()["amount"] == 75.0


@pytest.mark.asyncio
async def test_delete_conta_recorrente(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Conta5")
    create = await client.post("/recurring-accounts/", json={
        "description": "Streaming", "amount": 30.0, "due_day": 1,
        "category_id": cat_id, "subcategory_id": sub_id,
        "entity_type": "individual", "payment_method": "credit",
        "start_date": "2026-01-01T00:00:00",
    })
    conta_id = create.json()["id"]
    response = await client.delete(f"/recurring-accounts/{conta_id}")
    assert response.status_code == 200
    assert response.json()["id"] == conta_id
    get_resp = await client.get(f"/recurring-accounts/{conta_id}")
    assert get_resp.status_code == 404


@pytest.mark.asyncio
async def test_delete_conta_recorrente_not_found(client):
    response = await client.delete("/recurring-accounts/999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_renew_conta_recorrente(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "ContaRenew")
    create = await client.post("/recurring-accounts/", json={
        "description": "Assinatura", "amount": 40.0, "due_day": 10,
        "category_id": cat_id, "subcategory_id": sub_id,
        "entity_type": "individual", "payment_method": "pix",
        "start_date": "2025-06-01T00:00:00",
    })
    conta_id = create.json()["id"]

    # Deactivate first
    await client.put(f"/recurring-accounts/{conta_id}", json={"active": False})

    # Renew
    response = await client.post(f"/recurring-accounts/{conta_id}/renew")
    assert response.status_code == 200
    data = response.json()
    assert data["active"] is True
    # Renew generates 12 from current month (Jul 2026 onwards) → all 12 in future
    assert data["remaining_installments"] == 12


@pytest.mark.asyncio
async def test_generate_pending_transactions(client):
    cat, cat_id, sub_id = await create_categoria_with_sub(client, "Conta6")
    await client.post("/recurring-accounts/", json={
        "description": "Gas", "amount": 60.0, "due_day": 10,
        "category_id": cat_id, "subcategory_id": sub_id,
        "entity_type": "individual", "payment_method": "pix",
        "start_date": "2025-01-01T00:00:00",
    })
    response = await client.post("/recurring-accounts/generate", json={
        "start_date": "2026-01-01T00:00:00",
        "end_date": "2026-03-31T00:00:00",
    })
    assert response.status_code == 200
    data = response.json()
    assert data["generated"] >= 0
