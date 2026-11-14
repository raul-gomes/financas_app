"""Encryption of secrets at rest: roundtrip, key rotation and loud failures."""

import pytest
from cryptography.fernet import Fernet

from app.core.config import Config
from app.core.crypto import (
    ENCRYPTION_KEYS_ENV,
    SecretDecryptionError,
    decrypt_if_encrypted,
    decrypt_secret,
    encrypt_if_plain,
    encrypt_secret,
    is_encrypted,
    validate_encryption_keys,
)

# TEST-ONLY keys, generated fresh for each test run; never real secrets.
KEY_OLD = Fernet.generate_key().decode()
KEY_NEW = Fernet.generate_key().decode()
KEY_OTHER = Fernet.generate_key().decode()
PLAINTEXT = "pluggy-test-value-123"


def use_keys(monkeypatch: pytest.MonkeyPatch, keys: str | None) -> None:
    """Point the app configuration at the given comma-separated key list."""
    monkeypatch.setattr(Config, "PLUGGY_KEY_ENCRYPTION_KEYS", keys)


def test_roundtrip(monkeypatch):
    use_keys(monkeypatch, KEY_OLD)

    token = encrypt_secret(PLAINTEXT)

    assert token != PLAINTEXT
    assert PLAINTEXT not in token
    assert decrypt_secret(token) == PLAINTEXT


def test_encrypting_twice_gives_different_tokens(monkeypatch):
    use_keys(monkeypatch, KEY_OLD)

    assert encrypt_secret(PLAINTEXT) != encrypt_secret(PLAINTEXT)


def test_wrong_key_fails_loudly_without_leaking_values(monkeypatch):
    use_keys(monkeypatch, KEY_OLD)
    token = encrypt_secret(PLAINTEXT)
    use_keys(monkeypatch, KEY_OTHER)

    with pytest.raises(SecretDecryptionError) as excinfo:
        decrypt_secret(token)

    message = str(excinfo.value)
    assert ENCRYPTION_KEYS_ENV in message
    assert token not in message
    assert PLAINTEXT not in message


def test_garbage_ciphertext_fails_loudly(monkeypatch):
    use_keys(monkeypatch, KEY_OLD)

    with pytest.raises(SecretDecryptionError):
        decrypt_secret("not-a-token")


def test_rotation_old_key_still_decrypts_and_new_key_encrypts(monkeypatch):
    use_keys(monkeypatch, KEY_OLD)
    old_token = encrypt_secret(PLAINTEXT)

    use_keys(monkeypatch, f"{KEY_NEW},{KEY_OLD}")

    assert decrypt_secret(old_token) == PLAINTEXT
    new_token = encrypt_secret(PLAINTEXT)
    # Encrypted with the first key only: the new key alone can read it, the old one cannot.
    use_keys(monkeypatch, KEY_NEW)
    assert decrypt_secret(new_token) == PLAINTEXT
    use_keys(monkeypatch, KEY_OLD)
    with pytest.raises(SecretDecryptionError):
        decrypt_secret(new_token)


def test_keys_with_spaces_around_commas_are_accepted(monkeypatch):
    use_keys(monkeypatch, f" {KEY_NEW} , {KEY_OLD} ")

    assert decrypt_secret(encrypt_secret(PLAINTEXT)) == PLAINTEXT


@pytest.mark.parametrize("raw", [None, "", "   ", " , "])
def test_missing_keys_fail_naming_the_variable(raw):
    with pytest.raises(RuntimeError, match=ENCRYPTION_KEYS_ENV):
        validate_encryption_keys(raw)


def test_invalid_key_fails_naming_the_variable_but_not_the_value():
    bad_value = "this-is-not-a-fernet-key"

    with pytest.raises(RuntimeError, match=ENCRYPTION_KEYS_ENV) as excinfo:
        validate_encryption_keys(f"{KEY_OLD},{bad_value}")

    assert bad_value not in str(excinfo.value)
    assert KEY_OLD not in str(excinfo.value)


def test_encrypt_without_configured_keys_fails(monkeypatch):
    use_keys(monkeypatch, None)

    with pytest.raises(RuntimeError, match=ENCRYPTION_KEYS_ENV):
        encrypt_secret(PLAINTEXT)


def test_is_encrypted_detects_fernet_tokens(monkeypatch):
    use_keys(monkeypatch, KEY_OLD)

    assert is_encrypted(encrypt_secret(PLAINTEXT))
    assert not is_encrypted(PLAINTEXT)
    assert not is_encrypted("")


def test_encrypt_if_plain_is_idempotent(monkeypatch):
    use_keys(monkeypatch, KEY_OLD)

    once = encrypt_if_plain(PLAINTEXT, KEY_OLD)
    twice = encrypt_if_plain(once, KEY_OLD)

    assert once != PLAINTEXT
    assert twice == once
    assert decrypt_secret(twice) == PLAINTEXT


def test_decrypt_if_encrypted_is_idempotent(monkeypatch):
    use_keys(monkeypatch, KEY_OLD)
    token = encrypt_secret(PLAINTEXT)

    plain = decrypt_if_encrypted(token, KEY_OLD)

    assert plain == PLAINTEXT
    assert decrypt_if_encrypted(plain, KEY_OLD) == PLAINTEXT
