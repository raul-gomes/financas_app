"""PluggySyncService: import for the authenticated user, duplicates, key handling."""

from datetime import datetime
from types import SimpleNamespace

import pytest
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError

from app.core.crypto import encrypt_secret
from app.core.errors import ServerConfigError, ValidationError
from app.db.models.category import CategoryORM, SubcategoryORM
from app.db.models.transaction import TransactionORM
from app.db.models.user import UserORM
from app.services import pluggy_sync_service as module
from app.services.pluggy_sync_service import FALLBACK_DESCRIPTION, PluggySyncService

PLUGGY_PAYLOAD = [
    {
        "id": "ptx-1",
        "amount": -50.0,
        "type": "DEBIT",
        "date": "2026-01-10T00:00:00Z",
        "description": "Market",
    },
    {"id": "ptx-2", "amount": 200.0, "type": "CREDIT", "date": "2026-01-11T00:00:00Z"},
]


class FakePluggy:
    """Stand-in for the HTTP client: one bank account with two transactions."""

    closed = False
    payload: list[dict] = PLUGGY_PAYLOAD

    def __init__(self, api_key: str):
        self.api_key = api_key
        FakePluggy.closed = False

    async def fetch_accounts(self) -> list[dict]:
        return [{"id": "acc-1", "name": "Conta", "type": "BANK", "number": "341999"}]

    async def fetch_transactions(self, account_id: str) -> list[dict]:
        return FakePluggy.payload

    async def fetch_items(self) -> list:
        return [
            SimpleNamespace(
                id="i1", status="UPDATED", institution_name="Bank", institution_number=1
            )
        ]

    async def validate_api_key(self) -> bool:
        return self.api_key == "good-key"

    async def close(self) -> None:
        FakePluggy.closed = True


@pytest.fixture(autouse=True)
def fake_pluggy(monkeypatch):
    monkeypatch.setattr(module, "PluggyService", FakePluggy)
    monkeypatch.setattr(FakePluggy, "payload", PLUGGY_PAYLOAD)


@pytest.fixture
def evaluations(monkeypatch):
    """Replaces the limit evaluation with a recorder (the real one has its own tests)."""
    calls: list[tuple[int, int, int]] = []

    async def fake(session, user_id, year=None, month=None):
        calls.append((user_id, year, month))
        return []

    monkeypatch.setattr(module, "trigger_limit_evaluation", fake)
    return calls


async def _service_with_key(make_uow, user_id: int = 1, key: str | None = "good-key"):
    uow, user = await make_uow(user_id)
    await uow.session.execute(
        update(UserORM)
        .where(UserORM.id == user_id)
        .values(pluggy_api_key=encrypt_secret(key) if key else None)
    )
    await uow.session.commit()
    user = await uow.session.get(UserORM, user_id)
    return PluggySyncService(uow, user), uow


def _without_provider_ids() -> list[dict]:
    """The default payload with no provider ids (the only rows still checked for duplicates)."""
    return [{k: v for k, v in tx.items() if k != "id"} for tx in PLUGGY_PAYLOAD]


async def _count(session, model) -> int:
    return (await session.execute(select(func.count()).select_from(model))).scalar_one()


@pytest.mark.asyncio
async def test_sync_imports_rows_for_the_user_and_evaluates_limits_after_commit(
    async_session, make_uow, evaluations
):
    service, uow = await _service_with_key(make_uow)

    result = await service.sync()

    assert (result["imported"], result["accounts"], result["duplicates"]) == (2, 1, [])
    assert result["message"] == "2 transações importadas de 1 contas."
    assert evaluations == []
    await uow.commit()
    assert len(evaluations) == 1
    assert evaluations[0][0] == 1
    rows = (
        (await async_session.execute(select(TransactionORM).order_by(TransactionORM.id)))
        .unique()
        .scalars()
    )
    imported = list(rows)
    assert [(t.description, t.type, t.amount, t.bank_code) for t in imported] == [
        ("Market", "expense", 50.0, "341"),
        (FALLBACK_DESCRIPTION, "income", 200.0, "341"),
    ]
    assert {t.user_id for t in imported} == {1}
    assert FakePluggy.closed is True


@pytest.mark.asyncio
async def test_sync_rollback_leaves_nothing_behind(async_session, make_uow, evaluations):
    service, uow = await _service_with_key(make_uow)

    await service.sync()
    await uow.rollback()

    assert await _count(async_session, TransactionORM) == 0
    assert await _count(async_session, CategoryORM) == 0
    assert await _count(async_session, SubcategoryORM) == 0
    assert evaluations == []


@pytest.mark.asyncio
async def test_sync_flags_duplicates_of_the_users_own_transactions_only(
    async_session, make_uow, evaluations
):
    service, _ = await _service_with_key(make_uow)
    FakePluggy.payload = _without_provider_ids()
    await make_uow(2)  # the other user exists, with their own matching transaction
    category = CategoryORM(name="Any", entity_type="individual", limit=0, user_id=1)
    category.subcategories = [SubcategoryORM(name="Any")]
    other_category = CategoryORM(name="Any", entity_type="individual", limit=0, user_id=2)
    other_category.subcategories = [SubcategoryORM(name="Any")]
    async_session.add_all([category, other_category])
    await async_session.flush()

    def existing(user_id, cat):
        return TransactionORM(
            amount=200.0,
            description="Manual entry",
            transaction_date=datetime(2026, 1, 11, 9, 0),
            type="income",
            entity_type="individual",
            payment_method="pix",
            category_id=cat.id,
            subcategory_id=cat.subcategories[0].id,
            user_id=user_id,
        )

    mine, theirs = existing(1, category), existing(2, other_category)
    async_session.add_all([mine, theirs])
    await async_session.commit()

    result = await service.sync()

    assert len(result["duplicates"]) == 1
    duplicate = result["duplicates"][0]
    assert duplicate["existing_id"] == mine.id
    assert duplicate["existing_description"] == "Manual entry"
    assert duplicate["description"] == FALLBACK_DESCRIPTION


@pytest.mark.asyncio
async def test_sync_flags_duplicates_for_imports_that_carry_a_description(
    async_session, make_uow, evaluations
):
    """Regression (Q12 d): rows are found by the ids of the batch, not by description."""
    service, _ = await _service_with_key(make_uow)
    FakePluggy.payload = _without_provider_ids()
    category = CategoryORM(name="Any", entity_type="individual", limit=0, user_id=1)
    category.subcategories = [SubcategoryORM(name="Any")]
    async_session.add(category)
    await async_session.flush()
    manual = TransactionORM(
        amount=50.0,
        description="Lunch at the market",
        transaction_date=datetime(2026, 1, 10, 12, 0),
        type="expense",
        entity_type="individual",
        payment_method="pix",
        category_id=category.id,
        subcategory_id=category.subcategories[0].id,
        user_id=1,
    )
    async_session.add(manual)
    await async_session.commit()

    result = await service.sync()

    assert len(result["duplicates"]) == 1
    duplicate = result["duplicates"][0]
    assert duplicate["existing_id"] == manual.id
    assert duplicate["description"] == "Market"
    assert duplicate["new_id"] != manual.id


@pytest.mark.asyncio
async def test_sync_without_a_key_is_a_validation_error(make_uow):
    service, _ = await _service_with_key(make_uow, key=None)

    with pytest.raises(ValidationError):
        await service.sync()
    with pytest.raises(ValidationError):
        await service.list_accounts()


@pytest.mark.asyncio
async def test_validate_key_reports_validity_and_missing_key(make_uow):
    good, _ = await _service_with_key(make_uow, 1, "good-key")
    bad, _ = await _service_with_key(make_uow, 2, "bad-key")
    missing, _ = await _service_with_key(make_uow, 3, None)

    assert (await good.validate_key())["valid"] is True
    assert (await bad.validate_key())["valid"] is False
    assert await missing.validate_key() == {"valid": False, "message": "API Key não configurada."}


@pytest.mark.asyncio
async def test_list_accounts_returns_accounts_and_connections(make_uow):
    service, _ = await _service_with_key(make_uow)

    result = await service.list_accounts()

    assert [a["id"] for a in result["accounts"]] == ["acc-1"]
    assert result["items"] == [
        {"id": "i1", "status": "UPDATED", "institution_name": "Bank", "institution_number": 1}
    ]
    assert FakePluggy.closed is True


@pytest.mark.asyncio
async def test_an_undecryptable_stored_key_is_a_server_error_without_key_material(make_uow):
    service, _ = await _service_with_key(make_uow)
    service.user.pluggy_api_key = "not-a-valid-ciphertext"

    with pytest.raises(ServerConfigError) as exc:
        await service.sync()

    assert "not-a-valid-ciphertext" not in exc.value.message


def _same_day_purchase(provider_id: str | None) -> dict:
    row = {
        "amount": -30.0,
        "type": "DEBIT",
        "date": "2026-02-01T00:00:00Z",
        "description": "Coffee",
    }
    if provider_id is not None:
        row["id"] = provider_id
    return row


@pytest.mark.asyncio
async def test_sync_stores_the_provider_transaction_id(async_session, make_uow, evaluations):
    service, _ = await _service_with_key(make_uow)

    await service.sync()

    rows = (
        await async_session.execute(select(TransactionORM).order_by(TransactionORM.id))
    ).unique()
    assert [(t.external_source, t.external_id) for t in rows.scalars()] == [
        ("pluggy", "ptx-1"),
        ("pluggy", "ptx-2"),
    ]


@pytest.mark.asyncio
async def test_resync_is_idempotent_and_reports_the_skipped_rows(
    async_session, make_uow, evaluations
):
    service, uow = await _service_with_key(make_uow)
    await service.sync()
    await uow.commit()

    second = await service.sync()

    assert (second["imported"], second["skipped"], second["duplicates"]) == (0, 2, [])
    assert await _count(async_session, TransactionORM) == 2


@pytest.mark.asyncio
async def test_resync_imports_only_the_new_provider_ids(async_session, make_uow, evaluations):
    service, uow = await _service_with_key(make_uow)
    await service.sync()
    await uow.commit()
    new_row = {**_same_day_purchase("ptx-3"), "date": "2026-03-01T00:00:00Z"}
    FakePluggy.payload = [*PLUGGY_PAYLOAD, new_row]

    result = await service.sync()

    assert (result["imported"], result["skipped"]) == (1, 2)
    assert await _count(async_session, TransactionORM) == 3


@pytest.mark.asyncio
async def test_two_legit_same_day_same_amount_purchases_are_both_imported_and_not_flagged(
    async_session, make_uow, evaluations
):
    service, _ = await _service_with_key(make_uow)
    FakePluggy.payload = [_same_day_purchase("ptx-a"), _same_day_purchase("ptx-b")]

    result = await service.sync()

    assert (result["imported"], result["skipped"], result["duplicates"]) == (2, 0, [])


@pytest.mark.asyncio
async def test_a_repeated_provider_id_inside_one_payload_is_imported_once(
    async_session, make_uow, evaluations
):
    service, _ = await _service_with_key(make_uow)
    FakePluggy.payload = [_same_day_purchase("ptx-a"), _same_day_purchase("ptx-a")]

    result = await service.sync()

    assert (result["imported"], result["skipped"]) == (1, 1)


@pytest.mark.asyncio
async def test_rows_without_a_provider_id_are_imported_and_keep_the_duplicate_warning(
    async_session, make_uow, evaluations
):
    service, uow = await _service_with_key(make_uow)
    FakePluggy.payload = [_same_day_purchase(None)]
    await service.sync()
    await uow.commit()

    second = await service.sync()

    assert (second["imported"], second["skipped"]) == (1, 0)
    assert len(second["duplicates"]) == 1


@pytest.mark.asyncio
async def test_the_same_provider_id_is_not_a_duplicate_across_users(
    async_session, make_uow, evaluations
):
    first, uow1 = await _service_with_key(make_uow, 1)
    second, _ = await _service_with_key(make_uow, 2)
    await first.sync()
    await uow1.commit()

    result = await second.sync()

    assert (result["imported"], result["skipped"]) == (2, 0)
    assert await _count(async_session, TransactionORM) == 4


@pytest.mark.asyncio
async def test_the_database_rejects_a_repeated_provider_id_for_the_same_user(
    async_session, make_uow, evaluations
):
    service, uow = await _service_with_key(make_uow)
    await service.sync()
    await uow.commit()
    row = (
        (await async_session.execute(select(TransactionORM).order_by(TransactionORM.id)))
        .unique()
        .scalars()
        .first()
    )
    clone = TransactionORM(
        amount=1.0,
        description="clone",
        transaction_date=datetime(2026, 1, 1),
        type="expense",
        entity_type="individual",
        payment_method="pix",
        category_id=row.category_id,
        subcategory_id=row.subcategory_id,
        user_id=1,
        external_source="pluggy",
        external_id=row.external_id,
    )
    async_session.add(clone)

    with pytest.raises(IntegrityError):
        await async_session.flush()


async def _legacy_row(session, user_id: int, description: str, day: datetime, amount: float = 30.0):
    """A row as the pre-provider-id import wrote it: no external id, midnight date."""
    category = (
        (await session.execute(select(CategoryORM).where(CategoryORM.user_id == user_id)))
        .unique()
        .scalar_one_or_none()
    )
    if category is None:
        category = CategoryORM(name="Importado", entity_type="individual", limit=0, user_id=user_id)
        category.subcategories = [SubcategoryORM(name="Pluggy")]
        session.add(category)
        await session.flush()
    row = TransactionORM(
        amount=amount,
        description=description,
        transaction_date=day,
        type="expense",
        entity_type="individual",
        payment_method="pix",
        category_id=category.id,
        subcategory_id=(
            await session.execute(
                select(SubcategoryORM.id).where(SubcategoryORM.category_id == category.id)
            )
        ).scalar_one(),
        user_id=user_id,
    )
    session.add(row)
    await session.commit()
    return row


async def _all_rows(session) -> list[TransactionORM]:
    result = await session.execute(select(TransactionORM).order_by(TransactionORM.id))
    return list(result.unique().scalars())


@pytest.mark.asyncio
async def test_a_legacy_row_is_linked_to_the_provider_id_not_duplicated(
    async_session, make_uow, evaluations
):
    service, _ = await _service_with_key(make_uow)
    legacy = await _legacy_row(async_session, 1, "Coffee", datetime(2026, 2, 1))
    FakePluggy.payload = [_same_day_purchase("ptx-a")]

    result = await service.sync()

    assert (result["imported"], result["skipped"], result["linked"]) == (0, 1, 1)
    rows = await _all_rows(async_session)
    assert [(r.id, r.external_source, r.external_id) for r in rows] == [
        (legacy.id, "pluggy", "ptx-a")
    ]


@pytest.mark.asyncio
async def test_two_legacy_same_day_same_amount_rows_link_to_two_incoming_ids(
    async_session, make_uow, evaluations
):
    service, uow = await _service_with_key(make_uow)
    first = await _legacy_row(async_session, 1, "Coffee", datetime(2026, 2, 1))
    second = await _legacy_row(async_session, 1, "Coffee", datetime(2026, 2, 1))
    FakePluggy.payload = [_same_day_purchase("ptx-a"), _same_day_purchase("ptx-b")]

    result = await service.sync()
    await uow.commit()

    assert (result["imported"], result["linked"]) == (0, 2)
    rows = await _all_rows(async_session)
    assert [(r.id, r.external_id) for r in rows] == [(first.id, "ptx-a"), (second.id, "ptx-b")]


@pytest.mark.asyncio
async def test_a_third_incoming_id_is_inserted_when_only_two_legacy_rows_exist(
    async_session, make_uow, evaluations
):
    service, _ = await _service_with_key(make_uow)
    await _legacy_row(async_session, 1, "Coffee", datetime(2026, 2, 1))
    await _legacy_row(async_session, 1, "Coffee", datetime(2026, 2, 1))
    FakePluggy.payload = [_same_day_purchase(f"ptx-{n}") for n in "abc"]

    result = await service.sync()

    assert (result["imported"], result["linked"]) == (1, 2)
    assert len(await _all_rows(async_session)) == 3


@pytest.mark.asyncio
async def test_a_legacy_row_with_another_description_is_not_linked(
    async_session, make_uow, evaluations
):
    service, _ = await _service_with_key(make_uow)
    await _legacy_row(async_session, 1, "Bakery", datetime(2026, 2, 1))
    FakePluggy.payload = [_same_day_purchase("ptx-a")]

    result = await service.sync()

    assert (result["imported"], result["linked"]) == (1, 0)
    assert len(await _all_rows(async_session)) == 2


@pytest.mark.asyncio
async def test_legacy_rows_of_another_user_are_never_linked(async_session, make_uow, evaluations):
    service, _ = await _service_with_key(make_uow, 1)
    await make_uow(2)
    theirs = await _legacy_row(async_session, 2, "Coffee", datetime(2026, 2, 1))
    FakePluggy.payload = [_same_day_purchase("ptx-a")]

    result = await service.sync()

    assert (result["imported"], result["linked"]) == (1, 0)
    assert (await async_session.get(TransactionORM, theirs.id)).external_id is None
