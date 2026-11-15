"""PluggySyncService: import for the authenticated user, duplicates, key handling."""

from datetime import datetime
from types import SimpleNamespace

import pytest
from sqlalchemy import func, select, update

from app.core.crypto import encrypt_secret
from app.core.errors import ServerConfigError, ValidationError
from app.db.models.category import CategoryORM, SubcategoryORM
from app.db.models.transaction import TransactionORM
from app.db.models.user import UserORM
from app.services import pluggy_sync_service as module
from app.services.pluggy_sync_service import FALLBACK_DESCRIPTION, PluggySyncService

PLUGGY_PAYLOAD = [
    {"amount": -50.0, "type": "DEBIT", "date": "2026-01-10T00:00:00Z", "description": "Market"},
    {"amount": 200.0, "type": "CREDIT", "date": "2026-01-11T00:00:00Z"},
]


class FakePluggy:
    """Stand-in for the HTTP client: one bank account with two transactions."""

    closed = False

    def __init__(self, api_key: str):
        self.api_key = api_key
        FakePluggy.closed = False

    async def fetch_accounts(self) -> list[dict]:
        return [{"id": "acc-1", "name": "Conta", "type": "BANK", "number": "341999"}]

    async def fetch_transactions(self, account_id: str) -> list[dict]:
        return PLUGGY_PAYLOAD

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
