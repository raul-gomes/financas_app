import pytest


@pytest.mark.asyncio
async def test_list_limits_empty(client):
    response = await client.get("/limits/")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


@pytest.mark.asyncio
async def test_bulk_update_limits_create_new(client):
    payload = {
        "new": [
            {
                "categoria_nome": "NovaLimite",
                "natureza": "pf",
                "limite": 1000.0,
                "subcategorias": [
                    {"subcategoria_nome": "SubNova1"},
                    {"subcategoria_nome": "SubNova2"},
                ],
            }
        ],
        "modified": [],
    }
    response = await client.put("/limits/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["created_categories"] == 1


@pytest.mark.asyncio
async def test_bulk_update_limits_modify_existing(client):
    cat, cat_id, sub_id = await _create_cat(client)
    payload = {
        "new": [],
        "modified": [
            {
                "id": cat_id,
                "categoria_nome": "Alimentacao",
                "natureza": "pf",
                "limite": 2000.0,
                "subcategorias": [
                    {"id": sub_id, "subcategoria_nome": "Supermercado"},
                ],
            }
        ],
    }
    response = await client.put("/limits/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["updated_categories"] == 1


@pytest.mark.asyncio
async def test_bulk_update_limits_empty(client):
    payload = {"new": [], "modified": []}
    response = await client.put("/limits/", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True


async def _create_cat(client):
    resp = await client.post("/categorias/", json={
        "categoria_nome": "Alimentacao",
        "natureza": "pf",
        "limite": 1000.0,
        "subcategorias": [{"subcategoria_nome": "Supermercado"}],
    })
    assert resp.status_code == 201
    cat = resp.json()
    opts = await client.get("/dashboard/opcoes-categorias")
    opt = next((c for c in opts.json()["opcoes"] if c["categoria"] == "Alimentacao"), None)
    sub_id = opt["subcategorias"][0]["id"] if opt and opt["subcategorias"] else None
    return cat, cat["id"], sub_id
