import pytest
from io import BytesIO


@pytest.mark.asyncio
async def test_upload_csv_file(client):
    csv_content = b"data,descricao,valor\n01/01/2026,Compra,100.50\n02/01/2026,Mercado,250.75"
    files = {"file": ("test.csv", BytesIO(csv_content), "text/csv")}
    response = await client.post("/extractos/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["entradas"] == 2
    assert data["total_entradas"] == 351.25


@pytest.mark.asyncio
async def test_upload_csv_with_entradas_e_saidas(client):
    csv_content = b"data,descricao,valor\n01/01/2026,Salario,3000.00\n02/01/2026,Compra,-100.50"
    files = {"file": ("test.csv", BytesIO(csv_content), "text/csv")}
    response = await client.post("/extractos/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["entradas"] == 1
    assert data["saidas"] == 1


@pytest.mark.asyncio
async def test_upload_csv_negative_values(client):
    csv_content = b"data,descricao,valor\n01/01/2026,Compra,-100.50\n02/01/2026,Mercado,-250.75"
    files = {"file": ("test.csv", BytesIO(csv_content), "text/csv")}
    response = await client.post("/extractos/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 2
    assert data["saidas"] == 2


@pytest.mark.asyncio
async def test_upload_auto_detect_csv(client):
    csv_content = b"data,descricao,valor\n01/01/2026,Teste,-50.00"
    files = {"file": ("test.txt", BytesIO(csv_content), "text/plain")}
    response = await client.post("/extractos/upload", files=files)
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 1
    assert data["saidas"] == 1


@pytest.mark.asyncio
async def test_confirm_parsed_transactions(client):
    cat, cat_id, sub_id = await _create_cat(client)
    payload = {
        "transacoes": [
            {
                "data": "01/01/2026",
                "descricao": "Compra",
                "valor": 100.0,
                "tipo": "saida",
                "categoria_id": cat_id,
                "subcategoria_id": sub_id,
            }
        ]
    }
    response = await client.post("/extractos/confirm", json=payload)
    assert response.status_code == 200
    assert response.json()["criadas"] == 1


@pytest.mark.asyncio
async def test_confirm_multiple_transactions(client):
    cat, cat_id, sub_id = await _create_cat(client)
    payload = {
        "transacoes": [
            {
                "data": "01/01/2026",
                "descricao": "Corrida 1",
                "valor": 25.0,
                "tipo": "saida",
                "categoria_id": cat_id,
                "subcategoria_id": sub_id,
            },
            {
                "data": "02/01/2026",
                "descricao": "Corrida 2",
                "valor": 30.0,
                "tipo": "saida",
                "categoria_id": cat_id,
                "subcategoria_id": sub_id,
            },
        ]
    }
    response = await client.post("/extractos/confirm", json=payload)
    assert response.status_code == 200
    assert response.json()["criadas"] == 2


@pytest.mark.asyncio
async def test_confirm_empty_transactions(client):
    payload = {"transacoes": []}
    response = await client.post("/extractos/confirm", json=payload)
    assert response.status_code == 200
    assert response.json()["criadas"] == 0


async def _create_cat(client):
    payload = {
        "categoria_nome": "ExtratoCat",
        "natureza": "pf",
        "limite": 1000.0,
        "subcategorias": [{"subcategoria_nome": "Sub1"}],
    }
    resp = await client.post("/categorias/", json=payload)
    assert resp.status_code == 201
    cat = resp.json()
    opts = await client.get("/dashboard/opcoes-categorias")
    opt = next((c for c in opts.json()["opcoes"] if c["categoria"] == "ExtratoCat"), None)
    sub_id = opt["subcategorias"][0]["id"] if opt and opt["subcategorias"] else None
    return cat, cat["id"], sub_id
