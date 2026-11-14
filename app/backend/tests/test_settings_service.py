"""SettingsService: profile and banks of the authenticated user, one commit per request."""

import pytest
from sqlalchemy import func, select

from app.core.crypto import decrypt_secret
from app.core.errors import NotFoundError, ValidationError
from app.db.models.user_bank import UserBankORM
from app.db.repositories.transaction import TransacaoRepository
from app.schemas.settings import BankCreate, ProfileUpdate
from app.services.settings_service import SettingsService

PLAIN_KEY = "test-only-pluggy-key"


async def _bank_count(session) -> int:
    return (await session.execute(select(func.count()).select_from(UserBankORM))).scalar_one()


@pytest.mark.asyncio
async def test_add_bank_flushes_only_and_rollback_leaves_nothing(async_session, make_uow):
    uow, user = await make_uow(1)
    service = SettingsService(uow, user)

    bank = await service.add_bank(BankCreate(bank_code="341", bank_name="Itau"))
    assert bank.id is not None
    assert bank.created_at is not None
    await uow.rollback()

    assert await _bank_count(async_session) == 0


@pytest.mark.asyncio
async def test_banks_are_listed_and_removed_only_for_their_owner(async_session, make_uow):
    owner_uow, owner = await make_uow(1)
    owner_service = SettingsService(owner_uow, owner)
    bank_id = (await owner_service.add_bank(BankCreate(bank_code="341", bank_name="Itau"))).id
    await owner_uow.commit()
    intruder_uow, intruder = await make_uow(2)
    intruder_service = SettingsService(intruder_uow, intruder)

    assert await intruder_service.list_banks() == []
    with pytest.raises(NotFoundError):
        await intruder_service.remove_bank(bank_id)
    assert await _bank_count(async_session) == 1

    await owner_service.remove_bank(bank_id)
    await owner_uow.commit()
    assert await _bank_count(async_session) == 0


@pytest.mark.asyncio
async def test_update_profile_encrypts_the_key_and_empty_string_removes_it(make_uow):
    uow, user = await make_uow(1)
    service = SettingsService(uow, user)

    updated = await service.update_profile(ProfileUpdate(name="New", pluggy_api_key=PLAIN_KEY))
    assert updated.name == "New"
    assert updated.pluggy_api_key != PLAIN_KEY
    assert decrypt_secret(updated.pluggy_api_key) == PLAIN_KEY

    cleared = await service.update_profile(ProfileUpdate(pluggy_api_key=""))
    assert cleared.pluggy_api_key is None


@pytest.mark.asyncio
async def test_profile_is_the_authenticated_user(make_uow):
    uow, user = await make_uow(1)

    assert SettingsService(uow, user).profile() is user


@pytest.mark.asyncio
async def test_assign_random_banks_needs_at_least_one_bank(make_uow):
    uow, user = await make_uow(1)

    with pytest.raises(ValidationError):
        await SettingsService(uow, user).assign_random_banks()


@pytest.mark.asyncio
async def test_assign_random_banks_uses_only_the_users_bank_codes(make_uow, monkeypatch):
    calls: list[tuple[list[str], int]] = []

    async def fake_assign(self, bank_codes, user_id):
        calls.append((sorted(bank_codes), user_id))
        return 3

    monkeypatch.setattr(TransacaoRepository, "assign_random_banks", fake_assign)
    other_uow, other = await make_uow(2)
    await SettingsService(other_uow, other).add_bank(BankCreate(bank_code="999", bank_name="X"))
    uow, user = await make_uow(1)
    service = SettingsService(uow, user)
    await service.add_bank(BankCreate(bank_code="341", bank_name="Itau"))
    await service.add_bank(BankCreate(bank_code="001", bank_name="BB"))

    assert await service.assign_random_banks() == 3
    assert calls == [(["001", "341"], 1)]
