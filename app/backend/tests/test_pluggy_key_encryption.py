"""The Pluggy API key is stored encrypted and decrypted only to call Pluggy."""

from datetime import UTC, datetime
from typing import ClassVar

from sqlalchemy import text

from app.core.crypto import decrypt_secret, encrypt_secret
from app.core.security import get_current_user
from app.db.models.user import UserORM
from app.main import app

PLAINTEXT_KEY = "plain-pluggy-key-for-tests"


async def stored_value(async_session, user_id: int = 1) -> str | None:
    """Read the raw column, bypassing the ORM, to see exactly what is persisted."""
    row = await async_session.execute(
        text("SELECT pluggy_api_key FROM users WHERE id = :id"), {"id": user_id}
    )
    return row.scalar_one()


async def test_profile_update_stores_ciphertext_not_plaintext(client, async_session):
    resp = await client.put("/settings/profile", json={"pluggy_api_key": PLAINTEXT_KEY})

    assert resp.status_code == 200, resp.text
    assert resp.json()["has_pluggy_key"] is True
    assert PLAINTEXT_KEY not in resp.text
    raw = await stored_value(async_session)
    assert raw is not None
    assert raw != PLAINTEXT_KEY
    assert PLAINTEXT_KEY not in raw
    assert decrypt_secret(raw) == PLAINTEXT_KEY


async def test_empty_string_still_removes_the_key(client, async_session):
    await client.put("/settings/profile", json={"pluggy_api_key": PLAINTEXT_KEY})

    resp = await client.put("/settings/profile", json={"pluggy_api_key": ""})

    assert resp.status_code == 200
    assert resp.json()["has_pluggy_key"] is False
    assert await stored_value(async_session) is None


async def test_omitting_the_field_keeps_the_stored_ciphertext(client, async_session):
    await client.put("/settings/profile", json={"pluggy_api_key": PLAINTEXT_KEY})
    before = await stored_value(async_session)

    await client.put("/settings/profile", json={"name": "Outro Nome"})

    assert await stored_value(async_session) == before


class FakePluggy:
    """Records the key it is built with instead of calling the network."""

    received_keys: ClassVar[list[str]] = []

    def __init__(self, api_key: str):
        type(self).received_keys.append(api_key)

    async def validate_api_key(self) -> bool:
        return True

    async def fetch_accounts(self) -> list[dict]:
        return []

    async def fetch_items(self) -> list:
        return []

    async def close(self) -> None:
        return None


def user_with_stored_key(stored: str | None) -> UserORM:
    """Build a detached admin user whose column holds ``stored`` as-is."""
    now = datetime.now(UTC)
    return UserORM(
        id=1,
        name="Teste",
        email="teste@teste.com",
        role="admin",
        pluggy_api_key=stored,
        created_at=now,
        updated_at=now,
    )


async def test_pluggy_calls_receive_the_decrypted_key(client, monkeypatch):
    user = user_with_stored_key(encrypt_secret(PLAINTEXT_KEY))

    async def _current_user() -> UserORM:
        return user

    app.dependency_overrides[get_current_user] = _current_user
    FakePluggy.received_keys = []
    monkeypatch.setattr("app.routes.pluggy_routes.PluggyService", FakePluggy)

    validate = await client.get("/pluggy/validate-key")
    accounts = await client.get("/pluggy/accounts")
    sync = await client.post("/pluggy/sync")

    assert validate.status_code == 200 and validate.json()["valid"] is True
    assert accounts.status_code == 200
    assert sync.status_code == 200
    assert FakePluggy.received_keys == [PLAINTEXT_KEY] * 3


async def test_undecryptable_stored_key_returns_500_without_leaking(client, monkeypatch):
    user = user_with_stored_key("gAAAAA-corrupted-or-from-another-key")

    async def _current_user() -> UserORM:
        return user

    app.dependency_overrides[get_current_user] = _current_user
    FakePluggy.received_keys = []
    monkeypatch.setattr("app.routes.pluggy_routes.PluggyService", FakePluggy)

    resp = await client.get("/pluggy/validate-key")

    assert resp.status_code == 500
    assert "gAAAAA" not in resp.text
    assert FakePluggy.received_keys == []
