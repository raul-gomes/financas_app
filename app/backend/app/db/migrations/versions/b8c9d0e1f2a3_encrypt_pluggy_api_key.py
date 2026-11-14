"""encrypt users.pluggy_api_key at rest (S2)

Revision ID: b8c9d0e1f2a3
Revises: c9d0e1f2a3b4
Create Date: 2026-11-14

Data-only migration: existing plaintext values are encrypted with the first key in
PLUGGY_KEY_ENCRYPTION_KEYS (Fernet). The column is an unbounded VARCHAR, so the longer
ciphertext needs no type change. Idempotent: values that already are Fernet tokens are skipped.
Downgrade decrypts back to plaintext. The key is only required when there is something to
encrypt/decrypt; the migration fails with a clear message if it is missing then.
"""

import sqlalchemy as sa
from alembic import op

from app.core.config import Config
from app.core.crypto import decrypt_if_encrypted, encrypt_if_plain, is_encrypted

revision = "b8c9d0e1f2a3"
down_revision = "c9d0e1f2a3b4"
branch_labels = None
depends_on = None

users = sa.table("users", sa.column("id", sa.Integer), sa.column("pluggy_api_key", sa.String))


def _non_empty_keys(connection: sa.Connection) -> list[tuple[int, str]]:
    """Return (id, stored value) for every user that has a non-empty Pluggy key."""
    rows = connection.execute(
        sa.select(users.c.id, users.c.pluggy_api_key).where(
            users.c.pluggy_api_key.is_not(None), users.c.pluggy_api_key != ""
        )
    )
    return [(row.id, row.pluggy_api_key) for row in rows]


def _rewrite(connection: sa.Connection, changes: dict[int, str]) -> None:
    """Persist ``{user id: new stored value}``."""
    for user_id, value in changes.items():
        connection.execute(
            users.update().where(users.c.id == user_id).values(pluggy_api_key=value)
        )


def upgrade() -> None:
    connection = op.get_bind()
    plain_rows = [(i, v) for i, v in _non_empty_keys(connection) if not is_encrypted(v)]
    # Raises a RuntimeError naming PLUGGY_KEY_ENCRYPTION_KEYS if the key is absent or invalid.
    keys = Config.PLUGGY_KEY_ENCRYPTION_KEYS
    _rewrite(connection, {i: encrypt_if_plain(v, keys) for i, v in plain_rows})


def downgrade() -> None:
    connection = op.get_bind()
    encrypted_rows = [(i, v) for i, v in _non_empty_keys(connection) if is_encrypted(v)]
    keys = Config.PLUGGY_KEY_ENCRYPTION_KEYS
    _rewrite(connection, {i: decrypt_if_encrypted(v, keys) for i, v in encrypted_rows})
