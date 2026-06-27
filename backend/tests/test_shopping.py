import pytest
from datetime import date


MES_REF = "2026-06-01"
MES_SEGUINTE = "2026-07-01"


@pytest.mark.asyncio
async def test_create_shopping_item(client):
    """Cria um item na lista de compras."""
    response = await client.post("/shopping/", json={
        "nome": "Notebook",
        "mes_ref": MES_REF,
    })
    assert response.status_code == 201
    data = response.json()
    assert data["nome"] == "Notebook"
    assert data["mes_ref"] == MES_REF
    assert data["marcado"] is False
    assert "id" in data


@pytest.mark.asyncio
async def test_list_shopping_by_month(client):
    """Lista itens de um mês específico."""
    await client.post("/shopping/", json={"nome": "Item 1", "mes_ref": MES_REF})
    await client.post("/shopping/", json={"nome": "Item 2", "mes_ref": MES_REF})

    response = await client.get(f"/shopping/?mes={MES_REF}")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


@pytest.mark.asyncio
async def test_list_shopping_other_month(client):
    """Itens de outro mês não devem aparecer."""
    await client.post("/shopping/", json={"nome": "Item Junho", "mes_ref": MES_REF})

    response = await client.get(f"/shopping/?mes=2026-07-01")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 0


@pytest.mark.asyncio
async def test_toggle_shopping_item(client):
    """Marca/desmarca um item."""
    resp = await client.post("/shopping/", json={"nome": "Item", "mes_ref": MES_REF})
    item_id = resp.json()["id"]

    # Marca como True
    response = await client.put(f"/shopping/{item_id}", json={"marcado": True})
    assert response.status_code == 200
    assert response.json()["marcado"] is True

    # Desmarca
    response = await client.put(f"/shopping/{item_id}", json={"marcado": False})
    assert response.status_code == 200
    assert response.json()["marcado"] is False


@pytest.mark.asyncio
async def test_update_shopping_item_name(client):
    """Atualiza o nome de um item."""
    resp = await client.post("/shopping/", json={"nome": "Antigo", "mes_ref": MES_REF})
    item_id = resp.json()["id"]

    response = await client.put(f"/shopping/{item_id}", json={"nome": "Novo Nome"})
    assert response.status_code == 200
    assert response.json()["nome"] == "Novo Nome"


@pytest.mark.asyncio
async def test_delete_shopping_item(client):
    """Exclui um item."""
    resp = await client.post("/shopping/", json={"nome": "Item para deletar", "mes_ref": MES_REF})
    item_id = resp.json()["id"]

    response = await client.delete(f"/shopping/{item_id}")
    assert response.status_code == 200

    # Verifica que não está mais na lista
    list_resp = await client.get(f"/shopping/?mes={MES_REF}")
    ids = [i["id"] for i in list_resp.json()]
    assert item_id not in ids


@pytest.mark.asyncio
async def test_migrate_unchecked_items(client):
    """Migra itens não-marcados para o próximo mês."""
    # Cria itens no mês atual
    resp1 = await client.post("/shopping/", json={"nome": "Nao marcado", "mes_ref": MES_REF})
    resp2 = await client.post("/shopping/", json={"nome": "Marcado", "mes_ref": MES_REF})
    item_nao_marcado = resp1.json()
    item_marcado = resp2.json()

    # Marca um deles
    await client.put(f"/shopping/{item_marcado['id']}", json={"marcado": True})

    # Migra
    response = await client.post(f"/shopping/migrar?mes_origem={MES_REF}&mes_destino={MES_SEGUINTE}")
    assert response.status_code == 200
    result = response.json()
    assert result["quantidade"] == 1  # Só o não-marcado

    # Verifica que o item apareceu no mês seguinte
    list_resp = await client.get(f"/shopping/?mes={MES_SEGUINTE}")
    items = list_resp.json()
    assert len(items) == 1
    assert items[0]["nome"] == "Nao marcado"
    assert items[0]["marcado"] is False


@pytest.mark.asyncio
async def test_migrate_no_items(client):
    """Migração sem itens não-marcados retorna 0."""
    resp = await client.post("/shopping/", json={"nome": "Unico item", "mes_ref": MES_REF})
    item_id = resp.json()["id"]
    await client.put(f"/shopping/{item_id}", json={"marcado": True})

    response = await client.post(f"/shopping/migrar?mes_origem={MES_REF}&mes_destino={MES_SEGUINTE}")
    assert response.status_code == 200
    assert response.json()["quantidade"] == 0


@pytest.mark.asyncio
async def test_sorting_unchecked_first(client):
    """Itens não-marcados aparecem antes dos marcados."""
    await client.post("/shopping/", json={"nome": "Segundo", "mes_ref": MES_REF})
    resp = await client.post("/shopping/", json={"nome": "Primeiro", "mes_ref": MES_REF})
    await client.put(f"/shopping/{resp.json()['id']}", json={"marcado": True})

    response = await client.get(f"/shopping/?mes={MES_REF}")
    items = response.json()
    # O primeiro item deve ser o não-marcado
    assert items[0]["marcado"] is False
    assert items[0]["nome"] == "Segundo"
