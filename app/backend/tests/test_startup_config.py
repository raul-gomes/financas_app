"""Fail-fast configuration and the Pluggy sync fallback description."""

from datetime import UTC, datetime

import pytest

from app.core.config import require_database_url
from app.core.security import get_current_user
from app.db.models.user import UserORM
from app.db.repositories.transaction import TransacaoRepository
from app.main import app


def test_missing_database_url_fails_with_clear_message():
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        require_database_url(None)


def test_blank_database_url_fails_with_clear_message():
    with pytest.raises(RuntimeError, match="DATABASE_URL"):
        require_database_url("   ")


def test_database_url_is_returned_when_present():
    assert require_database_url("sqlite+aiosqlite:///:memory:") == "sqlite+aiosqlite:///:memory:"


class _FakePluggy:
    """Stand-in for PluggyService returning one account with one description-less transaction."""

    def __init__(self, api_key: str):
        self.api_key = api_key

    async def fetch_accounts(self) -> list[dict]:
        return [{"id": "acc-1", "name": "Conta", "type": "BANK", "number": "123456"}]

    async def fetch_transactions(self, account_id: str) -> list[dict]:
        return [{"amount": 10.0, "type": "DEBIT", "date": "2026-01-10T00:00:00Z"}]

    async def close(self) -> None:
        return None


async def test_pluggy_sync_uses_correctly_spelled_fallback_description(client, monkeypatch):
    now = datetime.now(UTC)
    user = UserORM(
        id=1,
        name="Teste",
        email="teste@teste.com",
        password_hash="",
        role="admin",
        pluggy_api_key="fake-key",
        created_at=now,
        updated_at=now,
    )

    async def _current_user() -> UserORM:
        return user

    app.dependency_overrides[get_current_user] = _current_user
    monkeypatch.setattr("app.routes.pluggy_routes.PluggyService", _FakePluggy)
    captured: list[dict] = []

    async def _fake_batch(self, transactions: list[dict], user_id: int) -> tuple[int, list]:
        captured.extend(transactions)
        return 0, []

    monkeypatch.setattr(TransacaoRepository, "create_batch_from_extract", _fake_batch)

    sync = await client.post("/pluggy/sync")

    assert sync.status_code == 200, sync.text
    assert [t["description"] for t in captured] == ["Sincronizado"]
