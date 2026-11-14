"""Data migration that encrypts existing plaintext Pluggy keys (and decrypts on downgrade)."""

import importlib.util
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic.migration import MigrationContext
from alembic.operations import Operations
from cryptography.fernet import Fernet

from app.core.config import Config
from app.core.crypto import ENCRYPTION_KEYS_ENV, decrypt_secret, is_encrypted

MIGRATION_PATH = (
    Path(__file__).resolve().parent.parent
    / "app/db/migrations/versions/b8c9d0e1f2a3_encrypt_pluggy_api_key.py"
)
# TEST-ONLY throwaway key; never a real secret.
TEST_KEY = Fernet.generate_key().decode()

metadata = sa.MetaData()
users = sa.Table(
    "users",
    metadata,
    sa.Column("id", sa.Integer, primary_key=True),
    sa.Column("pluggy_api_key", sa.String, nullable=True),
)


def load_migration():
    """Import the migration module from its file (versions/ is not a package)."""
    spec = importlib.util.spec_from_file_location("encrypt_pluggy_migration", MIGRATION_PATH)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def connection(monkeypatch):
    """Sync SQLite connection with a users table and the test key configured."""
    monkeypatch.setattr(Config, "PLUGGY_KEY_ENCRYPTION_KEYS", TEST_KEY)
    engine = sa.create_engine("sqlite://")
    metadata.create_all(engine)
    with engine.begin() as conn:
        yield conn


def run(conn: sa.Connection, direction: str) -> None:
    """Run the migration's upgrade/downgrade inside an Alembic operations context."""
    module = load_migration()
    with Operations.context(MigrationContext.configure(conn)):
        getattr(module, direction)()


def stored(conn: sa.Connection) -> dict[int, str | None]:
    """Return the raw ``pluggy_api_key`` column keyed by user id."""
    rows = conn.execute(sa.select(users.c.id, users.c.pluggy_api_key).order_by(users.c.id))
    return {row.id: row.pluggy_api_key for row in rows}


def test_upgrade_encrypts_plaintext_and_leaves_empty_rows(connection):
    connection.execute(
        users.insert(),
        [
            {"id": 1, "pluggy_api_key": "plain-one"},
            {"id": 2, "pluggy_api_key": None},
            {"id": 3, "pluggy_api_key": ""},
        ],
    )

    run(connection, "upgrade")

    rows = stored(connection)
    assert is_encrypted(rows[1])
    assert decrypt_secret(rows[1]) == "plain-one"
    assert rows[2] is None
    assert rows[3] == ""


def test_upgrade_is_idempotent(connection):
    connection.execute(users.insert(), [{"id": 1, "pluggy_api_key": "plain-one"}])
    run(connection, "upgrade")
    after_first = stored(connection)

    run(connection, "upgrade")

    assert stored(connection) == after_first


def test_upgrade_fails_clearly_when_plaintext_exists_and_key_is_absent(connection, monkeypatch):
    connection.execute(users.insert(), [{"id": 1, "pluggy_api_key": "plain-one"}])
    monkeypatch.setattr(Config, "PLUGGY_KEY_ENCRYPTION_KEYS", None)

    with pytest.raises(RuntimeError, match=ENCRYPTION_KEYS_ENV):
        run(connection, "upgrade")

    assert stored(connection) == {1: "plain-one"}


def test_upgrade_without_plaintext_rows_does_not_need_the_key(connection, monkeypatch):
    monkeypatch.setattr(Config, "PLUGGY_KEY_ENCRYPTION_KEYS", None)

    run(connection, "upgrade")

    assert stored(connection) == {}


def test_downgrade_decrypts_back_to_plaintext(connection):
    connection.execute(users.insert(), [{"id": 1, "pluggy_api_key": "plain-one"}])
    run(connection, "upgrade")

    run(connection, "downgrade")

    assert stored(connection) == {1: "plain-one"}
    run(connection, "downgrade")
    assert stored(connection) == {1: "plain-one"}
