"""Schema guard: legacy credential columns must not come back (pendencias S8)."""

from app.db.models.user import UserORM

LEGACY_COLUMN = "password_hash"


def test_users_table_has_no_local_password_column() -> None:
    """Passwords belong to Supabase; the users table must not store any hash."""
    assert LEGACY_COLUMN not in UserORM.__table__.columns
