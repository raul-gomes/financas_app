import pytest
from sqlalchemy import select

from app.db.models.user import UserORM
from app.db.repositories.users import IdentityConflictError, get_or_create_user_from_supabase

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

    result = await async_session.execute(select(UserORM).where(UserORM.email == "dup@example.com"))
    users = result.scalars().all()
    assert len(users) == 1


@pytest.mark.asyncio
async def test_new_user_always_gets_user_role(async_session):
    """Novo cadastro nasce como 'user'; admin só por promoção manual no banco."""
    user = await get_or_create_user_from_supabase(
        async_session, sub="new-user-role", email="newrole@example.com"
    )
    assert user.role == "user"


@pytest.mark.asyncio
async def test_first_user_gets_user_role(async_session):
    """Primeiro usuário também nasce como 'user' (sem bootstrap admin)."""
    user = await get_or_create_user_from_supabase(
        async_session, sub="first-user-role", email="firstrole@example.com"
    )
    assert user.role == "user"


@pytest.mark.asyncio
async def test_subsequent_users_become_regular(async_session):
    admin = await get_or_create_user_from_supabase(
        async_session, sub="existing-admin", email="existingadmin@example.com"
    )
    regular = await get_or_create_user_from_supabase(
        async_session, sub="second-user", email="second@example.com"
    )
    assert regular.role == "user"
    assert admin.role == "user"


@pytest.mark.asyncio
async def test_different_subs_create_different_users(async_session):
    user_a = await get_or_create_user_from_supabase(
        async_session, sub="user-a", email="a@example.com"
    )
    user_b = await get_or_create_user_from_supabase(
        async_session, sub="user-b", email="b@example.com"
    )

    assert user_a.id != user_b.id


# ── Testes: identidade pelo sub do Supabase (pendencias S4) ─────────


@pytest.mark.asyncio
async def test_user_is_found_by_sub_after_email_change(async_session):
    first = await get_or_create_user_from_supabase(
        async_session, sub="sub-email-change", email="old@example.com"
    )
    second = await get_or_create_user_from_supabase(
        async_session, sub="sub-email-change", email="new@example.com"
    )

    assert second.id == first.id
    assert second.email == "new@example.com"


@pytest.mark.asyncio
async def test_legacy_user_without_sub_is_linked_by_email(async_session):
    legacy = UserORM(name="Legado", email="legacy@example.com", role="admin")
    async_session.add(legacy)
    await async_session.commit()

    user = await get_or_create_user_from_supabase(
        async_session, sub="sub-legacy", email="legacy@example.com"
    )

    assert user.id == legacy.id
    assert user.supabase_id == "sub-legacy"
    assert user.role == "admin"


@pytest.mark.asyncio
async def test_email_owned_by_another_sub_is_refused(async_session):
    await get_or_create_user_from_supabase(
        async_session, sub="sub-owner", email="taken@example.com"
    )

    with pytest.raises(IdentityConflictError):
        await get_or_create_user_from_supabase(
            async_session, sub="sub-intruder", email="taken@example.com"
        )


# ── Concurrent first requests (deterministic race simulation) ─────────


def _miss_first_lookups(session, monkeypatch, misses: int) -> None:
    """Make the first ``misses`` queries see nothing, as if another request of the same
    login committed the user right after them (the app fires parallel first requests)."""
    from sqlalchemy import false

    original = session.execute
    remaining = {"misses": misses}

    async def execute(statement, *args, **kwargs):
        if remaining["misses"] > 0:
            remaining["misses"] -= 1
            statement = statement.where(false())
        return await original(statement, *args, **kwargs)

    monkeypatch.setattr(session, "execute", execute)


@pytest.mark.asyncio
async def test_parallel_first_request_finds_the_row_linked_by_the_other_one(
    async_session, monkeypatch
):
    async_session.add(UserORM(name="Ana", email="race@example.com", supabase_id="sub-race"))
    await async_session.commit()
    _miss_first_lookups(async_session, monkeypatch, misses=1)  # the lookup by sub

    user = await get_or_create_user_from_supabase(
        async_session, sub="sub-race", email="race@example.com"
    )

    assert user.supabase_id == "sub-race"


@pytest.mark.asyncio
async def test_parallel_first_sign_up_returns_the_user_the_other_request_created(
    async_session, monkeypatch
):
    async_session.add(UserORM(name="", email="new-race@example.com", supabase_id="sub-new"))
    await async_session.commit()
    _miss_first_lookups(async_session, monkeypatch, misses=2)  # by sub and by e-mail

    user = await get_or_create_user_from_supabase(
        async_session, sub="sub-new", email="new-race@example.com"
    )

    assert user.supabase_id == "sub-new"
    count = await async_session.execute(
        select(UserORM).where(UserORM.email == "new-race@example.com")
    )
    assert len(count.scalars().all()) == 1


@pytest.mark.asyncio
async def test_sign_up_racing_with_another_identity_is_still_a_conflict(async_session, monkeypatch):
    async_session.add(UserORM(name="", email="taken@example.com", supabase_id="sub-owner"))
    await async_session.commit()
    _miss_first_lookups(async_session, monkeypatch, misses=2)

    with pytest.raises(IdentityConflictError):
        await get_or_create_user_from_supabase(
            async_session, sub="sub-intruder", email="taken@example.com"
        )
