"""Batch import resolving categories and subcategories by name (Pluggy sync, extract)."""

import pytest
from sqlalchemy import select

from app.db.models.category import SubcategoryORM
from app.db.models.transaction import TransactionORM
from app.db.models.user import UserORM
from app.db.repositories.transaction import TransacaoRepository


def _row(description: str, category: str, subcategory: str) -> dict:
    return {
        "date": "05/01/2026",
        "amount": 10.0,
        "description": description,
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "debit",
        "category_name": category,
        "subcategory_name": subcategory,
    }


@pytest.mark.asyncio
async def test_batch_by_name_links_each_row_to_its_own_subcategory(async_session):
    async_session.add(UserORM(id=7, name="", email="batch@example.com", password_hash=""))
    await async_session.commit()
    repo = TransacaoRepository(async_session)

    created, errors = await repo.create_batch_from_extract(
        [_row("Pao", "Mercado", "Padaria"), _row("Uber", "Transporte", "App")],
        user_id=7,
    )

    assert errors == []
    assert created == 2
    rows = (
        await async_session.execute(
            select(TransactionORM.description, SubcategoryORM.name).join(
                SubcategoryORM, TransactionORM.subcategory_id == SubcategoryORM.id
            )
        )
    ).all()
    assert sorted(rows) == [("Pao", "Padaria"), ("Uber", "App")]
