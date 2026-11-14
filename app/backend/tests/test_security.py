import base64
import time
from unittest.mock import AsyncMock, MagicMock, patch

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.core.config import Config
from app.core.security import get_current_user, require_admin, require_role

# ── Fixtures ────────────────────────────────────────────────────────

TEST_SECRET = "test-supabase-jwt-secret-for-testing-only"
TEST_AUTH_URL = "http://localhost:9999"
TEST_ISSUER = f"{TEST_AUTH_URL}/auth/v1"


P256_COORDINATE_BYTES = 32


def _b64u(n: int) -> str:
    """Encode a P-256 coordinate as base64url, left-padded to the fixed 32-byte JWK width."""
    raw = n.to_bytes(P256_COORDINATE_BYTES, "big")
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode()


def test_jwk_coordinates_keep_leading_zero_bytes():
    # Regression: ~1 in 128 random keys has a coordinate with a leading zero byte, which the
    # old unpadded encoding shortened, making the ES256 test fail intermittently.
    decoded = base64.urlsafe_b64decode(_b64u(1) + "==")

    assert len(decoded) == P256_COORDINATE_BYTES


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
    payload = {
        "sub": sub,
        "email": email,
        "exp": int(time.time()) + 3600,
        "aud": "authenticated",
        "iss": TEST_ISSUER,
    }
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
    payload = {"sub": sub, "email": email, "aud": "authenticated", "iss": TEST_ISSUER}
    if exp is not None:
        payload["exp"] = exp
    else:
        payload["exp"] = int(time.time()) + 3600
    return jwt.encode(payload, TEST_SECRET, algorithm="HS256")


@pytest.fixture(autouse=True)
def patch_secret():
    with (
        patch.object(Config, "SUPABASE_JWT_SECRET", TEST_SECRET),
        patch.object(Config, "SUPABASE_AUTH_URL", TEST_AUTH_URL),
    ):
        yield


@pytest.fixture(autouse=True)
def mock_db_session():
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

    with (
        pytest.raises(HTTPException) as exc_info,
        patch("app.core.security._jwks_client", return_value=_FakeJwksClient(other_jwk)),
    ):
        await get_current_user(credentials=credentials, session=MagicMock())
    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_es256_token_sem_jwks_raises_401(mock_db_session):
    token = _make_es256_token(signing_jwk=_make_es256_jwk())
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)

    def _no_client():
        raise jwt.InvalidTokenError("JWKS indisponível")

    with (
        pytest.raises(HTTPException) as exc_info,
        patch("app.core.security._jwks_client", side_effect=_no_client),
    ):
        await get_current_user(credentials=credentials, session=MagicMock())
    assert exc_info.value.status_code == 401


# ── Testes: claims e algoritmo (pendencias S3) ───────────────────────


async def _assert_401(token: str) -> None:
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials=token)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(credentials=credentials, session=MagicMock())
    assert exc_info.value.status_code == 401


def _hs256(**claims: object) -> str:
    payload = {
        "sub": "claims-user",
        "email": "claims@example.com",
        "exp": int(time.time()) + 3600,
        "aud": "authenticated",
        "iss": TEST_ISSUER,
    }
    payload.update(claims)
    return jwt.encode({k: v for k, v in payload.items() if v is not None}, TEST_SECRET, "HS256")


@pytest.mark.asyncio
async def test_token_without_audience_raises_401(mock_db_session):
    await _assert_401(_hs256(aud=None))


@pytest.mark.asyncio
async def test_token_with_wrong_audience_raises_401(mock_db_session):
    await _assert_401(_hs256(aud="anon"))


@pytest.mark.asyncio
async def test_token_from_another_issuer_raises_401(mock_db_session):
    await _assert_401(_hs256(iss="https://evil.example.com/auth/v1"))


@pytest.mark.asyncio
async def test_token_without_issuer_raises_401(mock_db_session):
    await _assert_401(_hs256(iss=None))


@pytest.mark.asyncio
async def test_unsigned_token_raises_401(mock_db_session):
    token = jwt.encode(
        {"sub": "x", "email": "x@x.com", "aud": "authenticated", "iss": TEST_ISSUER},
        key=None,
        algorithm="none",
    )
    await _assert_401(token)


@pytest.mark.asyncio
async def test_hs256_token_without_configured_secret_raises_401(mock_db_session):
    with patch.object(Config, "SUPABASE_JWT_SECRET", ""):
        await _assert_401(_hs256())
