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
                "category_name": "NovaLimite",
                "entity_type": "individual",
                "limit": 1000.0,
                "subcategories": [
                    {"subcategory_name": "SubNova1"},
                    {"subcategory_name": "SubNova2"},
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
                "category_name": "Alimentacao",
                "entity_type": "individual",
                "limit": 2000.0,
                "subcategories": [
                    {"id": sub_id, "subcategory_name": "Supermercado"},
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
    resp = await client.post("/categories/", json={
        "category_name": "Alimentacao",
        "entity_type": "individual",
        "limit": 1000.0,
        "subcategories": [{"subcategory_name": "Supermercado"}],
    })
    assert resp.status_code == 201
    cat = resp.json()
    opts = await client.get("/dashboard/category-options")
    opt = next((c for c in opts.json()["options"] if c["name"] == "Alimentacao"), None)
    sub_id = opt["subcategories"][0]["id"] if opt and opt["subcategories"] else None
    return cat, cat["id"], sub_id
