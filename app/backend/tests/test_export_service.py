"""ExportService: CSV/OFX of the authenticated user's transactions, reproducible with a clock."""

from datetime import datetime

import pytest

from app.core.errors import ValidationError
from app.db.models.category import CategoryORM, SubcategoryORM
from app.db.models.transaction import TransactionORM
from app.services.export_service import ExportService

NOW = datetime(2026, 3, 20, 10, 0, 0)


async def _seed(
    session,
    user_id: int,
    description: str,
    day: datetime,
    amount: float,
    kind: str,
    category_name: str = "Food",
):
    category = CategoryORM(name=category_name, entity_type="individual", limit=0, user_id=user_id)
    category.subcategories = [SubcategoryORM(name="Lunch")]
    session.add(category)
    await session.flush()
    session.add(
        TransactionORM(
            amount=amount,
            description=description,
            transaction_date=day,
            type=kind,
            entity_type="individual",
            payment_method="pix",
            bank_code="341",
            category_id=category.id,
            subcategory_id=category.subcategories[0].id,
            user_id=user_id,
        )
    )
    await session.commit()


@pytest.mark.asyncio
async def test_csv_has_a_header_one_row_per_transaction_and_a_dated_filename(
    async_session, make_uow
):
    _, user = await make_uow(1)
    await _seed(async_session, 1, "Burger", datetime(2026, 3, 5), 12.5, "expense")

    file = await ExportService(async_session, user).export_csv("01/01/2026", None, now=NOW)

    lines = file.content.splitlines()
    assert lines[0].startswith("Data,Descri")
    assert lines[1:] == ["05/03/2026,Burger,12.50,expense,individual,pix,Food,Lunch,341,,"]
    assert (file.media_type, file.filename) == ("text/csv", "transacoes_20260320.csv")


@pytest.mark.asyncio
async def test_ofx_maps_types_and_stamps_the_server_date(async_session, make_uow):
    _, user = await make_uow(1)
    await _seed(async_session, 1, "Burger", datetime(2026, 3, 5), 12.5, "expense")

    file = await ExportService(async_session, user).export_ofx("01/01/2026", None, now=NOW)

    assert file.content.startswith("OFXHEADER:100\n")
    assert "<DTSERVER>20260320</>" in file.content
    assert "<TRNTYPE>DEBIT</TRNTYPE>" in file.content
    assert "<DTPOSTED>20260305</DTPOSTED>" in file.content
    assert "<TRNAMT>12.50</TRNAMT>" in file.content
    assert "<MEMO>Food/Lunch: Burger</MEMO>" in file.content
    assert file.content.endswith("</OFX>")
    assert (file.media_type, file.filename) == ("application/x-ofx", "transacoes_20260320.ofx")


@pytest.mark.asyncio
async def test_an_open_end_date_defaults_to_today_and_excludes_later_rows(async_session, make_uow):
    _, user = await make_uow(1)
    await _seed(async_session, 1, "Past", datetime(2026, 3, 5), 1.0, "income")
    await _seed(async_session, 1, "Future", datetime(2026, 4, 5), 2.0, "income", "Later")

    csv_file = await ExportService(async_session, user).export_csv("01/01/2026", None, now=NOW)

    assert "Past" in csv_file.content
    assert "Future" not in csv_file.content


@pytest.mark.asyncio
async def test_only_the_users_own_transactions_are_exported(async_session, make_uow):
    _, mine = await make_uow(1)
    _, theirs = await make_uow(2)
    await _seed(async_session, 1, "Mine", datetime(2026, 3, 5), 1.0, "income")
    await _seed(async_session, 2, "Theirs", datetime(2026, 3, 5), 2.0, "income")

    mine_file = await ExportService(async_session, mine).export_csv("01/01/2026", None, now=NOW)
    theirs_file = await ExportService(async_session, theirs).export_ofx("01/01/2026", None, now=NOW)

    assert "Mine" in mine_file.content
    assert "Theirs" not in mine_file.content
    assert "Theirs" in theirs_file.content
    assert "Mine" not in theirs_file.content


@pytest.mark.asyncio
async def test_a_malformed_date_is_a_validation_error(async_session, make_uow):
    _, user = await make_uow(1)

    with pytest.raises(ValidationError):
        await ExportService(async_session, user).export_csv("2026-01-01", None, now=NOW)
