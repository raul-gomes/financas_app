import pytest
from httpx import AsyncClient


async def create_transacao_com_categoria(client, descricao="Compras", data="2026-01-15T10:00:00"):
    payload = {
        "amount": 50.0,
        "description": descricao,
        "transaction_date": data,
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_name": "Alimentacao",
        "subcategory_name": "Supermercado",
    }
    resp = await client.post("/transacoes/", json=payload)
    assert resp.status_code == 201


@pytest.mark.asyncio
async def test_export_csv_inclui_categoria_subcategoria(client: AsyncClient):
    await create_transacao_com_categoria(client)

    resp = await client.get(
        "/export/csv",
        params={"start_date": "01/01/2000", "end_date": "31/12/2026"},
    )
    assert resp.status_code == 200
    assert resp.headers["content-type"].startswith("text/csv")
    body = resp.text
    assert "Compras" in body
    assert "Alimentacao" in body
    assert "Supermercado" in body


@pytest.mark.asyncio
async def test_export_ofx_inclui_transacao(client: AsyncClient):
    await create_transacao_com_categoria(client, descricao="Aluguel")

    resp = await client.get(
        "/export/ofx",
        params={"start_date": "01/01/2000", "end_date": "31/12/2026"},
    )
    assert resp.status_code == 200
    assert "<OFX>" in resp.text
    assert "Aluguel" in resp.text


@pytest.mark.asyncio
async def test_export_csv_data_invalida_retorna_400(client: AsyncClient):
    resp = await client.get(
        "/export/csv",
        params={"start_date": "data-invalida", "end_date": "31/12/2026"},
    )
    assert resp.status_code == 400
