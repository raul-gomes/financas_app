import pytest
from io import BytesIO


@pytest.mark.asyncio
async def test_upload_csv_file(client):
    csv_content = b"data,descricao,valor\n01/01/2026,Compra,100.50\n02/01/2026,Mercado,250.75"
    files = {"file": ("test.csv", BytesIO(csv_content), "text/csv")}
    response = await client.post("/extracts/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["total_income"] == 2
    assert data["total_income_amount"] == 351.25


@pytest.mark.asyncio
async def test_upload_csv_with_entradas_e_saidas(client):
    csv_content = b"data,descricao,valor\n01/01/2026,Salario,3000.00\n02/01/2026,Compra,-100.50"
    files = {"file": ("test.csv", BytesIO(csv_content), "text/csv")}
    response = await client.post("/extracts/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["total_income"] == 1
    assert data["total_expenses"] == 1


@pytest.mark.asyncio
async def test_upload_csv_negative_values(client):
    csv_content = b"data,descricao,valor\n01/01/2026,Compra,-100.50\n02/01/2026,Mercado,-250.75"
    files = {"file": ("test.csv", BytesIO(csv_content), "text/csv")}
    response = await client.post("/extracts/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["total_expenses"] == 2


@pytest.mark.asyncio
async def test_upload_auto_detect_csv(client):
    csv_content = b"data,descricao,valor\n01/01/2026,Teste,-50.00"
    files = {"file": ("test.txt", BytesIO(csv_content), "text/plain")}
    response = await client.post("/extracts/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["total_expenses"] == 1


@pytest.mark.asyncio
async def test_confirm_parsed_transactions(client):
    cat, cat_id, sub_id = await _create_cat(client)
    payload = {
        "transactions": [
            {
                "date": "01/01/2026",
                "description": "Compra",
                "amount": 100.0,
                "type": "expense",
                "category_id": cat_id,
                "subcategory_id": sub_id,
            }
        ]
    }
    response = await client.post("/extracts/confirm", json=payload)
    assert response.status_code == 200
    assert response.json()["created"] == 1


@pytest.mark.asyncio
async def test_confirm_multiple_transactions(client):
    cat, cat_id, sub_id = await _create_cat(client)
    payload = {
        "transactions": [
            {
                "date": "01/01/2026",
                "description": "Corrida 1",
                "amount": 25.0,
                "type": "expense",
                "category_id": cat_id,
                "subcategory_id": sub_id,
            },
            {
                "date": "02/01/2026",
                "description": "Corrida 2",
                "amount": 30.0,
                "type": "expense",
                "category_id": cat_id,
                "subcategory_id": sub_id,
            },
        ]
    }
    response = await client.post("/extracts/confirm", json=payload)
    assert response.status_code == 200
    assert response.json()["created"] == 2


@pytest.mark.asyncio
async def test_confirm_empty_transactions(client):
    payload = {"transactions": []}
    response = await client.post("/extracts/confirm", json=payload)
    assert response.status_code == 200
    assert response.json()["created"] == 0


async def _create_cat(client):
    payload = {
        "category_name": "ExtratoCat",
        "entity_type": "individual",
        "limit": 1000.0,
        "subcategories": [{"subcategory_name": "Sub1"}],
    }
    resp = await client.post("/categories/", json=payload)
    assert resp.status_code == 201
    cat = resp.json()
    opts = await client.get("/dashboard/category-options")
    opt = next((c for c in opts.json()["options"] if c["name"] == "ExtratoCat"), None)
    sub_id = opt["subcategories"][0]["id"] if opt and opt["subcategories"] else None
    return cat, cat["id"], sub_id
