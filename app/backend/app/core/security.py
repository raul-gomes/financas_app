import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import Config
from app.core.database import get_session
from app.db.models.user import UserORM
from app.db.repositories.users import get_or_create_user_from_supabase

bearer_scheme = HTTPBearer(auto_error=False)

_jwks_client_singleton: PyJWKClient | None = None


def _jwks_client() -> PyJWKClient:
    global _jwks_client_singleton
    if _jwks_client_singleton is None:
        _jwks_client_singleton = PyJWKClient(
            f"{Config.SUPABASE_AUTH_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        )
    return _jwks_client_singleton


def _decode_token(token: str) -> dict:
    header = jwt.get_unverified_header(token)
    alg = header.get("alg", "HS256")

    if alg.startswith("HS") or not Config.SUPABASE_AUTH_URL:
        return jwt.decode(
            token,
            Config.SUPABASE_JWT_SECRET,
            algorithms=["HS256"],
            options={"verify_aud": False},
        )

    signing_key = _jwks_client().get_signing_key_from_jwt(token)
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=[alg],
        options={"verify_aud": False},
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
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    sub = payload.get("sub")
    email = payload.get("email")
    if not sub or not email:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload"
        )

    user = await get_or_create_user_from_supabase(session, sub=sub, email=email)
    return user


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
