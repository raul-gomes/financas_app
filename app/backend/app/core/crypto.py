"""Encryption of secrets at rest (the user's Pluggy API key).

Keys come from ``PLUGGY_KEY_ENCRYPTION_KEYS``: comma-separated Fernet keys. The first key
encrypts; every key decrypts, so a new key can be prepended without losing old ciphertext
(rotation). Neither plaintext, ciphertext nor key material is ever put in a message or log.
"""

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken, MultiFernet

from app.core.config import Config

ENCRYPTION_KEYS_ENV = "PLUGGY_KEY_ENCRYPTION_KEYS"
# Every Fernet token starts with version byte 0x80 + a timestamp, i.e. "gAAAAA" in base64.
CIPHERTEXT_PREFIX = "gAAAAA"
GENERATE_KEY_HINT = (
    'uv run python -c "from cryptography.fernet import Fernet; '
    'print(Fernet.generate_key().decode())"'
)


class SecretDecryptionError(RuntimeError):
    """A stored secret could not be decrypted with the configured keys."""


def _split_keys(raw: str | None) -> list[str]:
    """Split the comma-separated key list, dropping blanks."""
    return [part.strip() for part in (raw or "").split(",") if part.strip()]


@lru_cache(maxsize=8)
def _build_cipher(raw: str | None) -> MultiFernet:
    """Build the MultiFernet for a raw key list, failing with a clear message.

    Raises:
        RuntimeError: if the list is empty or any entry is not a valid Fernet key. The message
            names the environment variable and never includes the offending value.
    """
    keys = _split_keys(raw)
    if not keys:
        raise RuntimeError(
            f"{ENCRYPTION_KEYS_ENV} environment variable is not set; configure it before "
            f"starting the application. Generate a key with: {GENERATE_KEY_HINT}"
        )
    fernets: list[Fernet] = []
    for position, key in enumerate(keys, start=1):
        try:
            fernets.append(Fernet(key.encode()))
        except ValueError as exc:
            raise RuntimeError(
                f"{ENCRYPTION_KEYS_ENV} is invalid: entry {position} is not a valid Fernet key "
                f"(32 url-safe base64-encoded bytes). Generate one with: {GENERATE_KEY_HINT}"
            ) from exc
    return MultiFernet(fernets)


def validate_encryption_keys(raw: str | None) -> None:
    """Fail fast if ``raw`` is not a usable key list (called at application startup)."""
    _build_cipher(raw)


def is_encrypted(value: str | None) -> bool:
    """Whether ``value`` looks like a Fernet token (cheap prefix check, no key needed)."""
    return bool(value) and value.startswith(CIPHERTEXT_PREFIX)


def encrypt_secret(plaintext: str, keys: str | None = None) -> str:
    """Encrypt ``plaintext`` with the first configured key.

    ``keys`` overrides the configured key list (used by migrations).
    """
    cipher = _build_cipher(Config.PLUGGY_KEY_ENCRYPTION_KEYS if keys is None else keys)
    return cipher.encrypt(plaintext.encode()).decode()


def decrypt_secret(token: str, keys: str | None = None) -> str:
    """Decrypt a token produced by :func:`encrypt_secret` with any configured key.

    Raises:
        SecretDecryptionError: if no configured key can decrypt it (wrong key, rotated out, or
            corrupted data). The message never includes the token.
    """
    cipher = _build_cipher(Config.PLUGGY_KEY_ENCRYPTION_KEYS if keys is None else keys)
    try:
        return cipher.decrypt(token.encode()).decode()
    except InvalidToken as exc:
        raise SecretDecryptionError(
            f"Stored secret could not be decrypted with the keys in {ENCRYPTION_KEYS_ENV}: "
            "wrong key, key rotated out, or corrupted value."
        ) from exc


def encrypt_if_plain(value: str, keys: str | None = None) -> str:
    """Encrypt ``value`` unless it already is a Fernet token (idempotent)."""
    return value if is_encrypted(value) else encrypt_secret(value, keys)


def decrypt_if_encrypted(value: str, keys: str | None = None) -> str:
    """Decrypt ``value`` if it is a Fernet token, else return it unchanged (idempotent)."""
    return decrypt_secret(value, keys) if is_encrypted(value) else value
