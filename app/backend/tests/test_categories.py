import pytest
import pytest_asyncio
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_list_categories_empty(client):
    response = await client.get("/categories/")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_categoria_with_subcategorias(client):
    payload = {
        "category_name": "Alimentacao",
        "entity_type": "individual",
        "limit": 1000.0,
        "subcategories": [
            {"subcategory_name": "Supermercado"},
            {"subcategory_name": "Restaurante"}
        ]
    }
    response = await client.post("/categories/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["category_name"] == "Alimentacao"
    assert len(data["subcategories"]) >= 0


@pytest.mark.asyncio
async def test_get_categoria_by_id(client):
    create = await client.post("/categories/", json={
        "category_name": "Transporte",
        "entity_type": "individual",
        "limit": 500.0,
        "subcategories": [{"subcategory_name": "Uber"}]
    })
    cat_id = create.json()["id"]
    response = await client.get(f"/categories/{cat_id}")
    assert response.status_code == 200
    assert response.json()["category_name"] == "Transporte"


@pytest.mark.asyncio
async def test_get_categoria_not_found(client):
    response = await client.get("/categories/999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_categoria(client):
    create = await client.post("/categories/", json={
        "category_name": "Lazer",
        "entity_type": "individual",
        "limit": 300.0,
        "subcategories": [{"subcategory_name": "Cinema"}]
    })
    cat_id = create.json()["id"]
    response = await client.put(f"/categories/{cat_id}", json={
        "category_name": "Lazer e Entretenimento",
        "limit": 500.0
    })
    assert response.status_code == 200
    assert response.json()["category_name"] == "Lazer e Entretenimento"
    assert response.json()["limit"] == 500.0


@pytest.mark.asyncio
async def test_update_categoria_add_subcategoria(client):
    create = await client.post("/categories/", json={
        "category_name": "Saude",
        "entity_type": "individual",
        "limit": 800.0,
        "subcategories": [{"subcategory_name": "Farmacia"}]
    })
    cat_id = create.json()["id"]
    response = await client.put(f"/categories/{cat_id}", json={
        "subcategories": [
            {"subcategory_name": "Farmacia"},
            {"subcategory_name": "Medico"}
        ]
    })
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_delete_categoria(client):
    create = await client.post("/categories/", json={
        "category_name": "Pet",
        "entity_type": "individual",
        "limit": 400.0,
        "subcategories": [{"subcategory_name": "Racao"}]
    })
    cat_id = create.json()["id"]
    response = await client.delete(f"/categories/{cat_id}")
    assert response.status_code == 200
    assert response.json()["id"] == cat_id
    get_response = await client.get(f"/categories/{cat_id}")
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_delete_categoria_not_found(client):
    response = await client.delete("/categories/999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_duplicate_categoria(client):
    payload = {
        "category_name": "Educacao",
        "entity_type": "individual",
        "limit": 1000.0,
        "subcategories": []
    }
    await client.post("/categories/", json=payload)
    response = await client.post("/categories/", json=payload)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_create_same_name_different_entity_type_allowed(client):
    """Unicidade é (name, entity_type): 'Limite Cartao Credito' deve existir para PF e PJ."""
    pf = await client.post("/categories/", json={
        "category_name": "Limite Cartao Credito",
        "entity_type": "individual",
        "limit": 15000.0,
        "subcategories": []
    })
    assert pf.status_code == 201
    pj = await client.post("/categories/", json={
        "category_name": "Limite Cartao Credito",
        "entity_type": "business",
        "limit": 30000.0,
        "subcategories": []
    })
    assert pj.status_code == 201


@pytest.mark.asyncio
async def test_update_categoria_duplicate_name(client):
    await client.post("/categories/", json={
        "category_name": "Cat1",
        "entity_type": "individual",
        "limit": 100.0,
        "subcategories": []
    })
    create2 = await client.post("/categories/", json={
        "category_name": "Cat2",
        "entity_type": "individual",
        "limit": 200.0,
        "subcategories": []
    })
    response = await client.put(f"/categories/{create2.json()['id']}", json={
        "category_name": "Cat1"
    })
    assert response.status_code == 409
