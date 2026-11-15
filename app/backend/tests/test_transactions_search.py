"""GET /transacoes/paginated text search: amount (pt-BR) and bank name, scoped by user."""

import pytest

PAGE_URL = "/transacoes/paginated"


def _payload(description: str, amount: float, bank_code: str | None = None) -> dict:
    return {
        "amount": amount,
        "description": description,
        "transaction_date": "2026-03-10T10:00:00",
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_name": "General",
        "subcategory_name": "General",
        "bank_code": bank_code,
    }


async def _add(client, description: str, amount: float, bank_code: str | None = None) -> int:
    response = await client.post("/transacoes/", json=_payload(description, amount, bank_code))
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def _add_bank(client, code: str, name: str) -> None:
    response = await client.post("/settings/banks", json={"bank_code": code, "bank_name": name})
    assert response.status_code == 201, response.text


async def _search(client, text: str) -> list[str]:
    response = await client.get(PAGE_URL, params={"search": text, "limit": 50})
    assert response.status_code == 200, response.text
    return sorted(item["description"] for item in response.json()["items"])


@pytest.fixture
async def amounts(clients_ctrl):
    """One user with transactions of several amounts and neutral descriptions."""
    clients_ctrl.switch(1)
    for description, amount in [
        ("alpha", 120.0),
        ("bravo", 120.5),
        ("charlie", 1200.0),
        ("delta", 1234.56),
        ("echo", 12.0),
    ]:
        await _add(clients_ctrl, description, amount)
    return clients_ctrl


@pytest.mark.asyncio
async def test_integer_amount_matches_the_exact_value_only(amounts):
    assert await _search(amounts, "120") == ["alpha"]


@pytest.mark.asyncio
async def test_amount_with_decimal_comma_matches_the_exact_value(amounts):
    assert await _search(amounts, "120,50") == ["bravo"]
    assert await _search(amounts, "120,5") == ["bravo"]


@pytest.mark.asyncio
async def test_amount_with_thousands_dot_and_decimal_comma(amounts):
    assert await _search(amounts, "1.234,56") == ["delta"]
    assert await _search(amounts, "R$ 1.200") == ["charlie"]


@pytest.mark.asyncio
async def test_non_numeric_text_is_not_treated_as_an_amount(amounts):
    assert await _search(amounts, "abc") == []
    assert await _search(amounts, "1,234.56") == []


@pytest.mark.asyncio
async def test_amount_and_text_matches_are_combined_with_or(clients_ctrl):
    clients_ctrl.switch(1)
    await _add(clients_ctrl, "Rent 120 parking", 999.0)
    await _add(clients_ctrl, "Plain", 120.0)
    await _add(clients_ctrl, "Other", 5.0)

    assert await _search(clients_ctrl, "120") == ["Plain", "Rent 120 parking"]


@pytest.mark.asyncio
async def test_search_by_amount_never_returns_another_users_transactions(clients_ctrl):
    clients_ctrl.switch(2)
    await _add(clients_ctrl, "theirs", 120.0)
    clients_ctrl.switch(1)
    await _add(clients_ctrl, "mine", 120.0)

    assert await _search(clients_ctrl, "120") == ["mine"]
    clients_ctrl.switch(2)
    assert await _search(clients_ctrl, "120") == ["theirs"]


@pytest.mark.asyncio
async def test_search_matches_the_name_of_the_users_bank(clients_ctrl):
    clients_ctrl.switch(1)
    await _add_bank(clients_ctrl, "341", "Itaú Unibanco")
    await _add_bank(clients_ctrl, "237", "Bradesco")
    await _add(clients_ctrl, "at itau", 10.0, bank_code="341")
    await _add(clients_ctrl, "at bradesco", 11.0, bank_code="237")
    await _add(clients_ctrl, "no bank", 12.0)

    assert await _search(clients_ctrl, "itaú") == ["at itau"]
    assert await _search(clients_ctrl, "BRADE") == ["at bradesco"]
    assert await _search(clients_ctrl, "banco inexistente") == []


@pytest.mark.asyncio
async def test_bank_name_search_does_not_use_another_users_banks(clients_ctrl):
    clients_ctrl.switch(2)
    await _add_bank(clients_ctrl, "237", "Bradesco")
    await _add(clients_ctrl, "theirs", 20.0, bank_code="237")
    clients_ctrl.switch(1)
    await _add(clients_ctrl, "mine", 21.0, bank_code="237")  # user 1 never named bank 237

    assert await _search(clients_ctrl, "bradesco") == []
    clients_ctrl.switch(2)
    assert await _search(clients_ctrl, "bradesco") == ["theirs"]


@pytest.mark.asyncio
async def test_total_counts_amount_and_bank_matches_too(clients_ctrl):
    clients_ctrl.switch(1)
    await _add_bank(clients_ctrl, "341", "Itaú")
    await _add(clients_ctrl, "one", 50.0, bank_code="341")
    await _add(clients_ctrl, "two", 50.0)
    await _add(clients_ctrl, "three", 7.0)

    by_amount = await clients_ctrl.get(PAGE_URL, params={"search": "50", "limit": 1})
    by_bank = await clients_ctrl.get(PAGE_URL, params={"search": "itaú"})

    assert by_amount.json()["total"] == 2
    assert by_amount.json()["has_more"] is True
    assert by_bank.json()["total"] == 1
