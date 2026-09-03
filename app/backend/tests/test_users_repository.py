import pytest
from sqlalchemy import select

from app.db.models.user import UserORM
from app.db.repositories.users import get_or_create_user_from_supabase


# ── Testes: upsert de usuário ────────────────────────────────────────

@pytest.mark.asyncio
async def test_creates_new_user_when_not_exists(async_session):
    user = await get_or_create_user_from_supabase(
        async_session, sub="new-user-001", email="new@example.com"
    )

    assert user.id is not None
    assert user.email == "new@example.com"
    assert user.name == ""


@pytest.mark.asyncio
async def test_returns_existing_user_on_second_call(async_session):
    user1 = await get_or_create_user_from_supabase(
        async_session, sub="existing-002", email="exist@example.com"
    )
    user2 = await get_or_create_user_from_supabase(
        async_session, sub="existing-002", email="exist@example.com"
    )

    assert user1.id == user2.id


@pytest.mark.asyncio
async def test_upsert_does_not_duplicate_users(async_session):
    await get_or_create_user_from_supabase(async_session, sub="dup-003", email="dup@example.com")
    await get_or_create_user_from_supabase(async_session, sub="dup-003", email="dup@example.com")

    result = await async_session.execute(
        select(UserORM).where(UserORM.email == "dup@example.com")
    )
    users = result.scalars().all()
    assert len(users) == 1


@pytest.mark.asyncio
async def test_first_user_becomes_admin(async_session):
    user = await get_or_create_user_from_supabase(
        async_session, sub="first-admin", email="first@example.com"
    )

    assert user.role == "admin"


@pytest.mark.asyncio
async def test_subsequent_users_become_regular(async_session):
    # Primeiro upsert vira admin
    admin = await get_or_create_user_from_supabase(
        async_session, sub="first-admin-2", email="first2@example.com"
    )
    assert admin.role == "admin"

    # Upsert subsequente (outro email) vira user comum
    regular = await get_or_create_user_from_supabase(
        async_session, sub="second-user", email="second@example.com"
    )
    assert regular.role == "user"


@pytest.mark.asyncio
async def test_different_subs_create_different_users(async_session):
    user_a = await get_or_create_user_from_supabase(
        async_session, sub="user-a", email="a@example.com"
    )
    user_b = await get_or_create_user_from_supabase(
        async_session, sub="user-b", email="b@example.com"
    )

    assert user_a.id != user_b.id
