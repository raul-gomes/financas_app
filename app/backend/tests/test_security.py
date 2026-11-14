import time
import base64
import json
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

import jwt

from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization

from app.core.security import get_current_user, require_role, require_admin
from app.core.config import Config


# ── Fixtures ────────────────────────────────────────────────────────

TEST_SECRET = "test-supabase-jwt-secret-for-testing-only"


def _b64u(n: int) -> str:
    raw = n.to_bytes((n.bit_length() + 7) // 8 or 1, "big")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def _make_es256_jwk() -> dict:
    private = ec.generate_private_key(ec.SECP256R1())
    pub = private.public_key()
    numbers = private.private_numbers()
    pubnum = pub.public_numbers()
    return {
        "kty": "EC",
        "crv": "P-256",
        "kid": "test-jwk-kid",
        "alg": "ES256",
        "x": _b64u(pubnum.x),
        "y": _b64u(pubnum.y),
        "d": _b64u(numbers.private_value),
    }


def _make_es256_token(
    sub: str = "es256-user", email: str = "es256@example.com", signing_jwk: dict | None = None
):
    jwk = signing_jwk or _make_es256_jwk()
    payload = {"sub": sub, "email": email, "exp": int(time.time()) + 3600, "aud": "authenticated"}
    return jwt.encode(payload, jwt.PyJWK(jwk).key, algorithm="ES256", headers={"kid": jwk["kid"]})


class _FakeSigningKey:
    def __init__(self, jwk: dict):
        self.key = jwk


class _FakeJwksClient:
    def __init__(self, jwk: dict):
        self._jwk = jwk

    def get_signing_key_from_jwt(self, _token: str) -> _FakeSigningKey:
        return _FakeSigningKey(jwt.PyJWK(self._jwk).key)


def _make_token(
    sub: str = "user-uuid-123", email: str = "test@example.com", exp: int | None = None
):
    payload = {"sub": sub, "email": email}
    if exp is not None:
        payload["exp"] = exp
    else:
        payload["exp"] = int(time.time()) + 3600
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")


@pytest.fixture(autouse=True)
def patch_secret():
    with (
        patch.object(Config, "SUPABASE_JWT_SECRET", TEST_SECRET),
        patch.object(Config, "SUPABASE_AUTH_URL", "http://localhost:9999"),
    ):
        yield


@pytest.fixture(autouse=True)
def mock_db_session():
    mock_session = MagicMock()
    with patch(
        "app.core.security.get_or_create_user_from_supabase", new_callable=AsyncMock
    ) as mock_upsert:
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


# ── Testes: token ES256 validado via JWKS (Supabase local/novos projetos) ────


@pytest.mark.asyncio
async def test_es256_token_validado_via_jwks(mock_db_session):
    signing_jwk = _make_es256_jwk()
    token = _make_es256_token(signing_jwk=signing_jwk)
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with patch("app.core.security._jwks_client", return_value=_FakeJwksClient(signing_jwk)):
        result = await get_current_user(credentials=credentials, session=MagicMock())

    assert result is not None

    mock_db_session.assert_called_once()
    _, kwargs = mock_db_session.call_args
    assert kwargs["sub"] == "es256-user"
    assert kwargs["email"] == "es256@example.com"


@pytest.mark.asyncio
async def test_es256_token_chave_diferente_raises_401(mock_db_session):
    signing_jwk = _make_es256_jwk()
    other_jwk = _make_es256_jwk()
    token = _make_es256_token(signing_jwk=signing_jwk)
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    with pytest.raises(HTTPException) as exc_info:
        with patch("app.core.security._jwks_client", return_value=_FakeJwksClient(other_jwk)):
            await get_current_user(credentials=credentials, session=MagicMock())
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_es256_token_sem_jwks_raises_401(mock_db_session):
    token = _make_es256_token(signing_jwk=_make_es256_jwk())
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    def _no_client():
        raise jwt.InvalidTokenError("JWKS indisponível")

    with pytest.raises(HTTPException) as exc_info:
        with patch("app.core.security._jwks_client", side_effect=_no_client):
            await get_current_user(credentials=credentials, session=MagicMock())
    assert exc_info.value.status_code == 401
