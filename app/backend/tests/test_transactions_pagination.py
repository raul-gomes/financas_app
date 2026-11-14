"""Paginated transactions endpoint: keyset cursor, stable ordering, filters, isolation."""

import pytest

from app.schemas.transaction import TRANSACTIONS_MAX_PAGE_SIZE

PAGE_URL = "/transacoes/paginated"


def transacao_payload(
    amount: float = 50.0,
    description: str = "Compras",
    transaction_date: str = "2026-01-15T10:00:00",
    tipo: str = "expense",
    entity_type: str = "individual",
    category_name: str = "Alimentacao",
    subcategory_name: str = "Supermercado",
) -> dict:
    """Builds a create payload that auto-creates the category/subcategory by name."""
    return {
        "amount": amount,
        "description": description,
        "transaction_date": transaction_date,
        "type": tipo,
        "entity_type": entity_type,
        "payment_method": "pix",
        "category_name": category_name,
        "subcategory_name": subcategory_name,
    }


async def _add(client, **kwargs) -> dict:
    resp = await client.post("/transacoes/", json=transacao_payload(**kwargs))
    assert resp.status_code == 201, resp.text
    return resp.json()


async def _all_pages(client, params: str = "", limit: int = 2) -> list[dict]:
    """Follows next_cursor until exhausted and returns every item in order."""
    items: list[dict] = []
    cursor = None
    for _ in range(50):
        url = f"{PAGE_URL}?limit={limit}{params}" + (f"&cursor={cursor}" if cursor else "")
        resp = await client.get(url)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        items.extend(body["items"])
        cursor = body["next_cursor"]
        if not body["has_more"]:
            assert cursor is None
            return items
    raise AssertionError("pagination did not terminate")


@pytest.mark.asyncio
async def test_orders_by_date_desc_then_id_desc_and_pages_do_not_overlap(client):
    # Three rows share the same timestamp: ties must break by id desc.
    created = [
        await _add(client, description="a", transaction_date="2026-03-10T10:00:00"),
        await _add(client, description="b", transaction_date="2026-03-10T10:00:00"),
        await _add(client, description="c", transaction_date="2026-03-10T10:00:00"),
        await _add(client, description="old", transaction_date="2026-01-01T10:00:00"),
        await _add(client, description="new", transaction_date="2026-04-01T10:00:00"),
    ]
    ids_by_desc = {t["description"]: t["id"] for t in created}

    items = await _all_pages(client, limit=2)

    assert [i["description"] for i in items] == ["new", "c", "b", "a", "old"]
    assert [i["id"] for i in items] == [
        ids_by_desc["new"],
        ids_by_desc["c"],
        ids_by_desc["b"],
        ids_by_desc["a"],
        ids_by_desc["old"],
    ]


@pytest.mark.asyncio
async def test_page_metadata_total_has_more_and_next_cursor(client):
    for day in range(1, 6):
        await _add(client, description=f"t{day}", transaction_date=f"2026-03-0{day}T10:00:00")

    first = (await client.get(f"{PAGE_URL}?limit=2")).json()
    assert first["total"] == 5
    assert first["limit"] == 2
    assert first["has_more"] is True
    assert first["next_cursor"]
    assert len(first["items"]) == 2

    last = (await client.get(f"{PAGE_URL}?limit=5")).json()
    assert last["total"] == 5
    assert last["has_more"] is False
    assert last["next_cursor"] is None


@pytest.mark.asyncio
async def test_new_row_between_pages_does_not_shift_the_next_page(client):
    for day in range(1, 5):
        await _add(client, description=f"t{day}", transaction_date=f"2026-03-0{day}T10:00:00")
    first = (await client.get(f"{PAGE_URL}?limit=2")).json()

    await _add(client, description="newest", transaction_date="2026-03-20T10:00:00")
    second = (await client.get(f"{PAGE_URL}?limit=2&cursor={first['next_cursor']}")).json()

    assert [i["description"] for i in first["items"]] == ["t4", "t3"]
    assert [i["description"] for i in second["items"]] == ["t2", "t1"]


@pytest.mark.asyncio
async def test_limit_is_capped_by_the_max_page_size(client):
    over = await client.get(f"{PAGE_URL}?limit={TRANSACTIONS_MAX_PAGE_SIZE + 1}")
    assert over.status_code == 422
    assert (await client.get(f"{PAGE_URL}?limit=0")).status_code == 422
    assert (await client.get(f"{PAGE_URL}?limit={TRANSACTIONS_MAX_PAGE_SIZE}")).status_code == 200


@pytest.mark.asyncio
async def test_filters_by_date_range_inclusive_of_the_end_day(client):
    await _add(client, description="before", transaction_date="2026-02-28T23:59:59")
    await _add(client, description="first", transaction_date="2026-03-01T00:00:00")
    await _add(client, description="last", transaction_date="2026-03-31T23:30:00")
    await _add(client, description="after", transaction_date="2026-04-01T00:00:00")

    items = await _all_pages(client, "&start_date=01/03/2026&end_date=31/03/2026")

    assert sorted(i["description"] for i in items) == ["first", "last"]


@pytest.mark.asyncio
async def test_invalid_date_or_cursor_returns_400(client):
    assert (await client.get(f"{PAGE_URL}?start_date=2026-03-01")).status_code == 400
    assert (await client.get(f"{PAGE_URL}?cursor=not-a-cursor")).status_code == 400


@pytest.mark.asyncio
async def test_filters_by_entity_type_type_and_category(client):
    await _add(client, description="pf-food", entity_type="individual", category_name="Food")
    await _add(client, description="pj-food", entity_type="business", category_name="Food")
    await _add(
        client,
        description="pf-salary",
        entity_type="individual",
        tipo="income",
        category_name="Work",
        subcategory_name="Pay",
    )

    pf = await _all_pages(client, "&entity_type=individual")
    pj = await _all_pages(client, "&entity_type=business")
    everyone = await _all_pages(client, "&entity_type=all")
    income = await _all_pages(client, "&type=income")

    assert sorted(i["description"] for i in pf) == ["pf-food", "pf-salary"]
    assert [i["description"] for i in pj] == ["pj-food"]
    assert len(everyone) == 3
    assert [i["description"] for i in income] == ["pf-salary"]

    work_id = next(i["category_id"] for i in everyone if i["description"] == "pf-salary")
    by_category = await _all_pages(client, f"&category_id={work_id}")
    assert [i["description"] for i in by_category] == ["pf-salary"]


@pytest.mark.asyncio
async def test_search_matches_description_case_insensitively_and_escapes_wildcards(client):
    await _add(client, description="Supermercado Extra")
    await _add(client, description="Padaria 100% pao")
    await _add(client, description="Padaria 1000 pao")

    assert [i["description"] for i in await _all_pages(client, "&search=supermercado")] == [
        "Supermercado Extra"
    ]
    # A literal percent sign must not behave as a LIKE wildcard.
    literal = await _all_pages(client, "&search=100%25")
    assert [i["description"] for i in literal] == ["Padaria 100% pao"]
    assert await _all_pages(client, "&search=nothing-like-this") == []


@pytest.mark.asyncio
async def test_search_is_length_limited(client):
    too_long = "x" * 101
    assert (await client.get(f"{PAGE_URL}?search={too_long}")).status_code == 422


@pytest.mark.asyncio
async def test_items_use_the_transaction_response_contract(client):
    await _add(client, description="shape")
    item = (await client.get(PAGE_URL)).json()["items"][0]

    assert {"id", "amount", "description", "transaction_date", "type", "entity_type"} <= set(item)
    assert item["category_name"] == "Alimentacao"
    assert item["subcategory_name"] == "Supermercado"


@pytest.mark.asyncio
async def test_each_user_only_sees_their_own_transactions(clients_ctrl):
    clients_ctrl.switch(1)
    mine = await _add(clients_ctrl, description="user1-tx")
    clients_ctrl.switch(2)
    await _add(clients_ctrl, description="user2-tx")

    own = await _all_pages(clients_ctrl)
    assert [i["description"] for i in own] == ["user2-tx"]

    # Other user's category id must yield nothing, not leak the rows.
    clients_ctrl.switch(2)
    leaked = await _all_pages(clients_ctrl, f"&category_id={mine['category_id']}")
    assert leaked == []

    clients_ctrl.switch(1)
    assert [i["description"] for i in await _all_pages(clients_ctrl)] == ["user1-tx"]
    body = (await clients_ctrl.get(PAGE_URL)).json()
    assert body["total"] == 1


@pytest.mark.asyncio
async def test_a_cursor_from_another_user_cannot_expose_their_rows(clients_ctrl):
    clients_ctrl.switch(1)
    for day in range(1, 4):
        await _add(
            clients_ctrl, description=f"u1-{day}", transaction_date=f"2026-03-0{day}T10:00:00"
        )
    cursor = (await clients_ctrl.get(f"{PAGE_URL}?limit=1")).json()["next_cursor"]

    clients_ctrl.switch(2)
    resp = await clients_ctrl.get(f"{PAGE_URL}?cursor={cursor}")

    assert resp.status_code == 200
    assert resp.json()["items"] == []
    assert resp.json()["total"] == 0


@pytest.mark.asyncio
async def test_requires_authentication(client_no_auth):
    assert (await client_no_auth.get(PAGE_URL)).status_code == 401


@pytest.mark.asyncio
async def test_legacy_list_endpoint_keeps_working(client):
    await _add(client, description="legacy")
    resp = await client.get("/transacoes/")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert resp.json()[0]["description"] == "legacy"
