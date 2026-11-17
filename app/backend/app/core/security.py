import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Config
from app.core.database import get_session
from app.db.models.user import UserORM
from app.db.repositories.users import IdentityConflictError, get_or_create_user_from_supabase

bearer_scheme = HTTPBearer(auto_error=False)

_jwks_client_singleton: PyJWKClient | None = None


def _jwks_client() -> PyJWKClient:
    global _jwks_client_singleton
    if _jwks_client_singleton is None:
        _jwks_client_singleton = PyJWKClient(
            f"{Config.SUPABASE_AUTH_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        )
    return _jwks_client_singleton


SUPABASE_AUDIENCE = "authenticated"
ASYMMETRIC_ALGORITHMS = ("ES256", "RS256")
HMAC_ALGORITHM = "HS256"


def _expected_issuer() -> str | None:
    """Issuer the tokens must carry: the explicit setting, else derived from the auth URL.

    Returns None when neither is configured.
    """
    if Config.SUPABASE_JWT_ISSUER:
        return Config.SUPABASE_JWT_ISSUER.rstrip("/")
    if not Config.SUPABASE_AUTH_URL:
        return None
    return f"{Config.SUPABASE_AUTH_URL.rstrip('/')}/auth/v1"


def _decode_token(token: str) -> dict:
    """Verify a Supabase access token: signature, expiry, audience and issuer.

    The algorithm is chosen from what the configuration allows, never trusted
    from the token: HS256 only when a JWT secret is configured, ES256/RS256 only
    through the project's JWKS. Anything else (including ``none``) is rejected.
    """
    alg = jwt.get_unverified_header(token).get("alg")
    issuer = _expected_issuer()
    options = {"require": ["exp", "sub", "aud"] + (["iss"] if issuer else [])}

    if alg == HMAC_ALGORITHM:
        if not Config.SUPABASE_JWT_SECRET:
            raise jwt.InvalidTokenError("HS256 token but no JWT secret configured")
        key = Config.SUPABASE_JWT_SECRET
        algorithms = [HMAC_ALGORITHM]
    elif alg in ASYMMETRIC_ALGORITHMS and Config.SUPABASE_AUTH_URL:
        try:
            key = _jwks_client().get_signing_key_from_jwt(token).key
        except jwt.PyJWKClientError as exc:
            raise jwt.InvalidTokenError("signing key not found") from exc
        algorithms = [alg]
    else:
        raise jwt.InvalidTokenError(f"algorithm not allowed: {alg!r}")

    return jwt.decode(
        token,
        key,
        algorithms=algorithms,
        audience=SUPABASE_AUDIENCE,
        issuer=issuer,
        options=options,
    )


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    session: AsyncSession = Depends(get_session),
) -> UserORM:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token missing")

    token = credentials.credentials
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token empty")

    try:
        payload = _decode_token(token)
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
        ) from exc

    sub = payload.get("sub")
    email = payload.get("email")
    if not sub or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload"
        )

    try:
        return await get_or_create_user_from_supabase(session, sub=sub, email=email)
    except IdentityConflictError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este e-mail já está vinculado a outra conta",
        ) from None


def require_role(*roles: str):
    """Dependency factory: garante que o usuário possui ao menos uma das roles,
    senão retorna 403. Reutilizável para múltiplas roles (Etapa 9).
    """

    async def _require_role(current_user: UserORM = Depends(get_current_user)) -> UserORM:
        if current_user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Acesso negado")
        return current_user

    return _require_role


require_admin = require_role("admin")
