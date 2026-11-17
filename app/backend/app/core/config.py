import os
from pathlib import Path

from dotenv import load_dotenv

# Search for .env from repo root
repo_root = Path(__file__).resolve().parent.parent.parent.parent.parent
load_dotenv(repo_root / ".env", override=False)


def require_database_url(value: str | None) -> str:
    """Return the database URL or fail fast, naming the missing environment variable."""
    if value is None or not value.strip():
        raise RuntimeError(
            "DATABASE_URL environment variable is not set; "
            "configure it before starting the application."
        )
    return value


DEFAULT_CORS_ORIGINS = ("http://localhost:8087", "http://localhost:8080", "http://localhost:8005")


def parse_cors_origins(raw: str | None) -> list[str]:
    """Parse a comma-separated origin list; fall back to the localhost dev defaults."""
    origins = [o.strip() for o in (raw or "").split(",") if o.strip()]
    return origins or list(DEFAULT_CORS_ORIGINS)


class Config:
    ENVIRONMENT = os.getenv("ENVIRONMENT", "development").strip().lower()
    CORS_ORIGINS = parse_cors_origins(os.getenv("CORS_ORIGINS"))
    DATABASE_URL = os.getenv("DATABASE_URL")
    DB_ECHO = os.getenv("DB_ECHO", "false").lower() == "true"
    DB_POOL_SIZE = int(os.getenv("DB_POOL_SIZE", "10"))
    DB_MAX_OVERFLOW = int(os.getenv("DB_MAX_OVERFLOW", "20"))
    DB_POOL_RECYCLE = int(os.getenv("DB_POOL_RECYCLE", "3600"))
    SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
    SUPABASE_AUTH_URL = os.getenv("SUPABASE_AUTH_URL", "")
    # Issuer (`iss`) the tokens carry. Empty = derived from SUPABASE_AUTH_URL; set it when the
    # API reaches Supabase through another address (local Supabase seen from Docker).
    SUPABASE_JWT_ISSUER = os.getenv("SUPABASE_JWT_ISSUER", "")
    # Comma-separated Fernet keys: the first encrypts the Pluggy key at rest, all decrypt.
    # Validated at startup by `app.core.crypto.validate_encryption_keys`.
    PLUGGY_KEY_ENCRYPTION_KEYS = os.getenv("PLUGGY_KEY_ENCRYPTION_KEYS")
    # Notificações de limite (e-mail via Resend)
    EMAIL_ALERTS_ENABLED = os.getenv("EMAIL_ALERTS_ENABLED", "false").lower() == "true"
    RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
    EMAIL_FROM = os.getenv("EMAIL_FROM", "Placo <onboarding@resend.dev>")
    ALERT_CHECK_INTERVAL = int(
        os.getenv("ALERT_CHECK_INTERVAL", "1800")
    )  # segundos (default 30 min)
