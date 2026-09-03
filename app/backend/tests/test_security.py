import time
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

import jwt

from app.core.security import get_current_user, require_role, require_admin
from app.core.config import Config


# ── Fixtures ────────────────────────────────────────────────────────

TEST_SECRET = "test-supabase-jwt-secret-for-testing-only"


def _make_token(sub: str = "user-uuid-123", email: str = "test@example.com", exp: int | None = None):
    payload = {"sub": sub, "email": email}
    if exp is not None:
        payload["exp"] = exp
    else:
        payload["exp"] = int(time.time()) + 3600
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")


@pytest.fixture(autouse=True)
def patch_secret():
    with patch.object(Config, "SUPABASE_JWT_SECRET", TEST_SECRET):
        yield


@pytest.fixture(autouse=True)
def mock_db_session():
    mock_session = MagicMock()
    with patch("app.core.security.get_or_create_user_from_supabase", new_callable=AsyncMock) as mock_upsert:
        mock_user = MagicMock()
        mock_user.id = 1
        mock_user.email = "test@example.com"
        mock_user.role = "admin"
        mock_upsert.return_value = mock_user
        yield mock_upsert


# ── Testes: require_role / require_admin ─────────────────────────────

@pytest.mark.asyncio
async def test_require_admin_allows_admin():
    admin = MagicMock()
    admin.role = "admin"
    result = await require_role("admin")(admin)
    assert result is admin


@pytest.mark.asyncio
async def test_require_admin_blocks_user():
    user = MagicMock()
    user.role = "user"
    with pytest.raises(HTTPException) as exc_info:
        await require_role("admin")(user)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_require_admin_alias_blocks_user():
    user = MagicMock()
    user.role = "user"
    with pytest.raises(HTTPException) as exc_info:
        await require_admin(user)
    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_require_role_multiple_roles():
    user = MagicMock()
    user.role = "manager"
    result = await require_role("admin", "manager")(user)
    assert result is user


# ── Testes: token válido ─────────────────────────────────────────────

@pytest.mark.asyncio
async def test_valid_token_returns_user(mock_db_session):
    token = _make_token(sub="auth-user-001", email="alice@example.com")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    result = await get_current_user(credentials=credentials, session=MagicMock())

    assert result is not None
    assert result.email == "test@example.com"


@pytest.mark.asyncio
async def test_valid_token_calls_upsert_with_correct_args(mock_db_session):
    token = _make_token(sub="auth-user-002", email="bob@example.com")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    await get_current_user(credentials=credentials, session=MagicMock())

    mock_db_session.assert_called_once()
    _, kwargs = mock_db_session.call_args
    assert kwargs["sub"] == "auth-user-002"
    assert kwargs["email"] == "bob@example.com"


# ── Testes: token inválido ──────────────────────────────────────────

@pytest.mark.asyncio
async def test_invalid_token_raises_401(mock_db_session):
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="invalid.token.here")

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=credentials, session=MagicMock())
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_wrong_secret_raises_401(mock_db_session):
    token = jwt.encode(
        {"sub": "x", "email": "x@x.com", "exp": int(time.time()) + 3600},
        "wrong-secret",
        algorithm="HS256",
    )
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=credentials, session=MagicMock())
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_expired_token_raises_401(mock_db_session):
    token = _make_token(sub="old-user", email="old@example.com", exp=int(time.time()) - 100)
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=credentials, session=MagicMock())
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_empty_token_raises_401(mock_db_session):
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="")

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=credentials, session=MagicMock())
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_none_credentials_raises_401(mock_db_session):
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=None, session=MagicMock())
    assert exc_info.value.status_code == 401


# ── Testes: token sem campos obrigatórios ────────────────────────────

@pytest.mark.asyncio
async def test_token_without_sub_raises_401(mock_db_session):
    payload = {"email": "no-sub@example.com", "exp": int(time.time()) + 3600}
    token = jwt.encode(payload, TEST_SECRET, algorithm="HS256")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=credentials, session=MagicMock())
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_token_without_email_raises_401(mock_db_session):
    payload = {"sub": "some-user", "exp": int(time.time()) + 3600}
    token = jwt.encode(payload, TEST_SECRET, algorithm="HS256")
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=credentials, session=MagicMock())
    assert exc_info.value.status_code == 401
