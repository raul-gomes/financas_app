import pytest
from datetime import date


MES_REF = "2026-06-01"
MES_SEGUINTE = "2026-07-01"


@pytest.mark.asyncio
async def test_create_shopping_item(client):
    """Cria um item na lista de compras."""
    response = await client.post(
        "/shopping/",
        json={
            "name": "Notebook",
            "reference_month": MES_REF,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Notebook"
    assert data["reference_month"] == MES_REF
    assert data["checked"] is False
    assert "id" in data


@pytest.mark.asyncio
async def test_list_shopping_by_month(client):
    """Lista itens de um mês específico."""
    await client.post("/shopping/", json={"name": "Item 1", "reference_month": MES_REF})
    await client.post("/shopping/", json={"name": "Item 2", "reference_month": MES_REF})

    response = await client.get(f"/shopping/?month={MES_REF}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_list_shopping_rollover_mes_seguinte(client):
    """Item não-marcado de um mês aparece no mês seguinte (rollover)."""
    await client.post("/shopping/", json={"name": "Airfryer", "reference_month": MES_REF})

    response = await client.get(f"/shopping/?month={MES_SEGUINTE}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["name"] == "Airfryer"
    assert data[0]["checked"] is False


@pytest.mark.asyncio
async def test_list_shopping_marcado_nao_rola_para_mes_seguinte(client):
    """Item adquirido (marcado) não rola para o mês seguinte (ex.: cama de casal)."""
    resp = await client.post(
        "/shopping/", json={"name": "Cama de Casal", "reference_month": MES_REF}
    )
    item_id = resp.json()["id"]
    await client.put(f"/shopping/{item_id}", json={"checked": True})

    response = await client.get(f"/shopping/?month={MES_SEGUINTE}")
    assert response.status_code == 200
    assert len(response.json()) == 0


@pytest.mark.asyncio
async def test_toggle_shopping_item(client):
    """Marca/desmarca um item."""
    resp = await client.post("/shopping/", json={"name": "Item", "reference_month": MES_REF})
    item_id = resp.json()["id"]

    # Marca como True
    response = await client.put(f"/shopping/{item_id}", json={"checked": True})
    assert response.status_code == 200
    assert response.json()["checked"] is True

    # Desmarca
    response = await client.put(f"/shopping/{item_id}", json={"checked": False})
    assert response.status_code == 200
    assert response.json()["checked"] is False


@pytest.mark.asyncio
async def test_update_shopping_item_name(client):
    """Atualiza o nome de um item."""
    resp = await client.post("/shopping/", json={"name": "Antigo", "reference_month": MES_REF})
    item_id = resp.json()["id"]

    response = await client.put(f"/shopping/{item_id}", json={"name": "Novo Nome"})
    assert response.status_code == 200
    assert response.json()["name"] == "Novo Nome"


@pytest.mark.asyncio
async def test_delete_shopping_item(client):
    """Exclui um item."""
    resp = await client.post(
        "/shopping/", json={"name": "Item para deletar", "reference_month": MES_REF}
    )
    item_id = resp.json()["id"]

    response = await client.delete(f"/shopping/{item_id}")
    assert response.status_code == 200

    # Verifica que não está mais na lista
    list_resp = await client.get(f"/shopping/?month={MES_REF}")
    ids = [i["id"] for i in list_resp.json()]
    assert item_id not in ids


@pytest.mark.asyncio
async def test_sorting_unchecked_first(client):
    """Itens não-marcados aparecem antes dos marcados."""
    await client.post("/shopping/", json={"name": "Segundo", "reference_month": MES_REF})
    resp = await client.post("/shopping/", json={"name": "Primeiro", "reference_month": MES_REF})
    await client.put(f"/shopping/{resp.json()['id']}", json={"checked": True})

    response = await client.get(f"/shopping/?month={MES_REF}")
    items = response.json()
    # O primeiro item deve ser o não-marcado
    assert items[0]["checked"] is False
    assert items[0]["name"] == "Segundo"
