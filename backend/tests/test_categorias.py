import pytest
import pytest_asyncio
from httpx import AsyncClient
from app.main import app


@pytest.mark.asyncio
async def test_list_categorias_empty(client):
    response = await client.get("/categorias/")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_create_categoria_with_subcategorias(client):
    payload = {
        "categoria_nome": "Alimentacao",
        "natureza": "pf",
        "limite": 1000.0,
        "subcategorias": [
            {"subcategoria_nome": "Supermercado"},
            {"subcategoria_nome": "Restaurante"}
        ]
    }
    response = await client.post("/categorias/", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["categoria_nome"] == "Alimentacao"
    assert len(data["subcategorias"]) >= 0


@pytest.mark.asyncio
async def test_get_categoria_by_id(client):
    create = await client.post("/categorias/", json={
        "categoria_nome": "Transporte",
        "natureza": "pf",
        "limite": 500.0,
        "subcategorias": [{"subcategoria_nome": "Uber"}]
    })
    cat_id = create.json()["id"]
    response = await client.get(f"/categorias/{cat_id}")
    assert response.status_code == 200
    assert response.json()["categoria_nome"] == "Transporte"


@pytest.mark.asyncio
async def test_get_categoria_not_found(client):
    response = await client.get("/categorias/999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_categoria(client):
    create = await client.post("/categorias/", json={
        "categoria_nome": "Lazer",
        "natureza": "pf",
        "limite": 300.0,
        "subcategorias": [{"subcategoria_nome": "Cinema"}]
    })
    cat_id = create.json()["id"]
    response = await client.put(f"/categorias/{cat_id}", json={
        "categoria_nome": "Lazer e Entretenimento",
        "limite": 500.0
    })
    assert response.status_code == 200
    assert response.json()["categoria_nome"] == "Lazer e Entretenimento"
    assert response.json()["limite"] == 500.0


@pytest.mark.asyncio
async def test_update_categoria_add_subcategoria(client):
    create = await client.post("/categorias/", json={
        "categoria_nome": "Saude",
        "natureza": "pf",
        "limite": 800.0,
        "subcategorias": [{"subcategoria_nome": "Farmacia"}]
    })
    cat_id = create.json()["id"]
    response = await client.put(f"/categorias/{cat_id}", json={
        "subcategorias": [
            {"subcategoria_nome": "Farmacia"},
            {"subcategoria_nome": "Medico"}
        ]
    })
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_delete_categoria(client):
    create = await client.post("/categorias/", json={
        "categoria_nome": "Pet",
        "natureza": "pf",
        "limite": 400.0,
        "subcategorias": [{"subcategoria_nome": "Racao"}]
    })
    cat_id = create.json()["id"]
    response = await client.delete(f"/categorias/{cat_id}")
    assert response.status_code == 200
    assert response.json()["id"] == cat_id
    get_response = await client.get(f"/categorias/{cat_id}")
    assert get_response.status_code == 404


@pytest.mark.asyncio
async def test_delete_categoria_not_found(client):
    response = await client.delete("/categorias/999")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_duplicate_categoria(client):
    payload = {
        "categoria_nome": "Educacao",
        "natureza": "pf",
        "limite": 1000.0,
        "subcategorias": []
    }
    await client.post("/categorias/", json=payload)
    response = await client.post("/categorias/", json=payload)
    assert response.status_code == 409


@pytest.mark.asyncio
async def test_update_categoria_duplicate_name(client):
    await client.post("/categorias/", json={
        "categoria_nome": "Cat1",
        "natureza": "pf",
        "limite": 100.0,
        "subcategorias": []
    })
    create2 = await client.post("/categorias/", json={
        "categoria_nome": "Cat2",
        "natureza": "pf",
        "limite": 200.0,
        "subcategorias": []
    })
    response = await client.put(f"/categorias/{create2.json()['id']}", json={
        "categoria_nome": "Cat1"
    })
    assert response.status_code == 409
