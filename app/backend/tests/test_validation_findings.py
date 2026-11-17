"""Regressions found in the 2026-11-17 end-to-end validation (PF/PJ)."""

import calendar
from datetime import datetime

import pytest
from sqlalchemy import select

from app.db.models.transaction import TransactionORM
from tests.test_transactions import create_categoria_with_sub


def _months_ago_first_day(months: int) -> datetime:
    """First day of the month ``months`` before the current one, at midnight."""
    now = datetime.now()
    year, month = now.year, now.month - months
    while month < 1:
        month += 12
        year -= 1
    return datetime(year, month, 1)


@pytest.mark.asyncio
async def test_transaction_by_category_name_uses_the_category_of_its_own_nature(client):
    """A PJ expense named after a category that also exists in PF lands in the PJ one."""
    _pf, pf_id, _ = await create_categoria_with_sub(
        client, "Alimentação", "individual", subs=[{"subcategory_name": "Restaurante"}]
    )
    _pj, pj_id, _ = await create_categoria_with_sub(
        client, "Alimentação", "business", subs=[{"subcategory_name": "Restaurante"}]
    )

    response = await client.post(
        "/transacoes/",
        json={
            "amount": 80.0,
            "description": "Almoço da equipe",
            "transaction_date": "2026-11-10T12:00:00",
            "type": "expense",
            "entity_type": "business",
            "payment_method": "pix",
            "category_name": "Alimentação",
            "subcategory_name": "Restaurante",
        },
    )

    assert response.status_code == 201
    assert response.json()["category_id"] == pj_id != pf_id


@pytest.mark.asyncio
async def test_transaction_by_category_name_creates_it_in_its_nature_when_only_the_other_exists(
    client,
):
    """With the name only in PF, a PJ expense creates a PJ category instead of borrowing the PF one."""
    _pf, pf_id, _ = await create_categoria_with_sub(client, "Transporte", "individual")

    response = await client.post(
        "/transacoes/",
        json={
            "amount": 30.0,
            "description": "Uber cliente",
            "transaction_date": "2026-11-10T12:00:00",
            "type": "expense",
            "entity_type": "business",
            "payment_method": "pix",
            "category_name": "Transporte",
            "subcategory_name": "Aplicativo",
        },
    )

    assert response.status_code == 201
    assert response.json()["category_id"] != pf_id
    categories = (await client.get("/categories/")).json()
    created = [c for c in categories if c["id"] == response.json()["category_id"]]
    assert created and created[0]["entity_type"] == "business"


@pytest.mark.asyncio
async def test_renaming_a_category_only_conflicts_within_the_same_nature(client):
    """The limits screen may give a PJ category a name that already exists in PF."""
    await create_categoria_with_sub(client, "Impostos", "individual")
    _pj, pj_id, _ = await create_categoria_with_sub(client, "Tributos", "business")

    response = await client.put(
        "/limits/",
        json={
            "new": [],
            "modified": [
                {"id": pj_id, "category_name": "Impostos", "entity_type": "business", "limit": 500}
            ],
            "deleted": [],
        },
    )

    assert response.status_code == 200
    assert response.json()["success"] is True, response.json()


@pytest.mark.asyncio
async def test_renaming_a_category_still_conflicts_inside_the_same_nature(client):
    """Two PJ categories with the same name stay forbidden."""
    await create_categoria_with_sub(client, "Marketing", "business")
    _pj, pj_id, _ = await create_categoria_with_sub(client, "Ads", "business")

    response = await client.put(
        "/limits/",
        json={
            "new": [],
            "modified": [
                {"id": pj_id, "category_name": "Marketing", "entity_type": "business", "limit": 500}
            ],
            "deleted": [],
        },
    )

    assert response.json()["success"] is False


@pytest.mark.asyncio
async def test_deleting_a_goal_with_contributions_is_refused_with_409(client, async_session):
    """A goal with contributions cannot be deleted (same rule as categories), instead of a 500."""
    goal = (
        await client.post(
            "/goals/",
            json={"subcategory_name": "Viagem", "target_amount": 2000, "entity_type": "individual"},
        )
    ).json()
    goal_id = goal.get("id", goal.get("subcategory_id"))
    contribution = await client.post(
        "/transacoes/",
        json={
            "amount": 500.0,
            "description": "Aporte viagem",
            "transaction_date": "2026-11-09T10:00:00",
            "type": "investment",
            "entity_type": "individual",
            "payment_method": "transfer",
            "category_id": goal["category_id"],
            "subcategory_id": goal_id,
        },
    )
    assert contribution.status_code == 201

    response = await client.delete(f"/goals/{goal_id}")

    assert response.status_code == 409
    assert "lançamentos" in response.json()["detail"]
    remaining = (
        (
            await async_session.execute(
                select(TransactionORM).where(TransactionORM.subcategory_id == goal_id)
            )
        )
        .unique()
        .scalars()
        .all()
    )
    assert len(remaining) == 1


@pytest.mark.asyncio
async def test_renew_is_refused_while_installments_remain(client):
    """The backend enforces can_renew: an active account with installments left cannot be renewed."""
    _cat, cat_id, sub_id = await create_categoria_with_sub(client, "Streaming")
    account = (
        await client.post(
            "/recurring-accounts/",
            json={
                "description": "Netflix",
                "amount": 55.0,
                "due_day": 15,
                "category_id": cat_id,
                "subcategory_id": sub_id,
                "entity_type": "individual",
                "payment_method": "credit",
                "start_date": _months_ago_first_day(0).isoformat(),
            },
        )
    ).json()

    response = await client.post(f"/recurring-accounts/{account['id']}/renew")

    assert response.status_code == 409
    listed = (await client.get(f"/recurring-accounts/{account['id']}")).json()
    assert listed["remaining_installments"] == 12


@pytest.mark.asyncio
async def test_editing_a_recurring_account_updates_installments_from_this_month_on(
    client, async_session
):
    """New amount, description, category and payment method apply from the current month; past ones keep theirs."""
    _cat, cat_id, sub_id = await create_categoria_with_sub(client, "Moradia")
    _cat2, cat2_id, sub2_id = await create_categoria_with_sub(client, "Casa")
    account = (
        await client.post(
            "/recurring-accounts/",
            json={
                "description": "Aluguel",
                "amount": 1500.0,
                "due_day": 5,
                "category_id": cat_id,
                "subcategory_id": sub_id,
                "entity_type": "individual",
                "payment_method": "pix",
                "start_date": _months_ago_first_day(2).isoformat(),
            },
        )
    ).json()

    response = await client.put(
        f"/recurring-accounts/{account['id']}",
        json={
            "amount": 1650.0,
            "description": "Aluguel novo",
            "category_id": cat2_id,
            "subcategory_id": sub2_id,
            "payment_method": "boleto",
        },
    )
    assert response.status_code == 200

    rows = (
        (
            await async_session.execute(
                select(TransactionORM)
                .where(TransactionORM.recurring_account_id == account["id"])
                .order_by(TransactionORM.transaction_date)
            )
        )
        .unique()
        .scalars()
        .all()
    )
    cutoff = _months_ago_first_day(0)
    past = [r for r in rows if r.transaction_date < cutoff]
    current_and_future = [r for r in rows if r.transaction_date >= cutoff]
    assert len(past) == 2 and len(current_and_future) == 10
    assert all(
        (r.amount, r.description, r.category_id, r.payment_method)
        == (1500.0, "Aluguel", cat_id, "pix")
        for r in past
    )
    assert all(
        (r.amount, r.category_id, r.subcategory_id, r.payment_method)
        == (1650.0, cat2_id, sub2_id, "boleto")
        and r.description.startswith("Aluguel novo")
        for r in current_and_future
    )


@pytest.mark.asyncio
async def test_changing_the_due_day_moves_installments_from_this_month_on(client, async_session):
    """A new due day moves current and future installments (capped at the month's last day); past ones stay."""
    _cat, cat_id, sub_id = await create_categoria_with_sub(client, "Internet")
    account = (
        await client.post(
            "/recurring-accounts/",
            json={
                "description": "Fibra",
                "amount": 120.0,
                "due_day": 5,
                "category_id": cat_id,
                "subcategory_id": sub_id,
                "entity_type": "business",
                "payment_method": "debit",
                "start_date": _months_ago_first_day(2).isoformat(),
            },
        )
    ).json()

    response = await client.put(f"/recurring-accounts/{account['id']}", json={"due_day": 31})
    assert response.status_code == 200
    assert response.json()["due_day"] == 31

    rows = (
        (
            await async_session.execute(
                select(TransactionORM)
                .where(TransactionORM.recurring_account_id == account["id"])
                .order_by(TransactionORM.transaction_date)
            )
        )
        .unique()
        .scalars()
        .all()
    )
    cutoff = _months_ago_first_day(0)
    past = [r for r in rows if r.transaction_date < cutoff]
    current_and_future = [r for r in rows if r.transaction_date >= cutoff]
    assert [r.transaction_date.day for r in past] == [5, 5]
    for row in current_and_future:
        last_day = calendar.monthrange(row.transaction_date.year, row.transaction_date.month)[1]
        assert row.transaction_date.day == last_day
    months = [(r.transaction_date.year, r.transaction_date.month) for r in rows]
    assert len(months) == len(set(months)) == 12
