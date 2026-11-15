from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import encrypt_secret
from app.core.database import get_session
from app.core.errors import NotFoundError
from app.db.models.user import UserORM
from app.db.models.user_bank import UserBankORM
from app.schemas.settings import BankCreate, ProfileUpdate


class SettingsRepository:
    """Perfil e bancos do usuário. Só faz flush: o commit é da unit of work (SettingsService)."""

    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db

    # ── Profile ───────────────────────────────────────────────

    async def update_profile(self, user_id: int, payload: ProfileUpdate) -> UserORM:
        result = await self.db.execute(select(UserORM).where(UserORM.id == user_id))
        user = result.scalars().first()
        if not user:
            raise NotFoundError("Usuário não encontrado")
        if payload.name is not None:
            user.name = payload.name
        if payload.pluggy_api_key is not None:
            # Stored encrypted; an empty string removes the key.
            user.pluggy_api_key = (
                encrypt_secret(payload.pluggy_api_key) if payload.pluggy_api_key else None
            )
        await self.db.flush()
        await self.db.refresh(user)
        return user

    # ── Banks ─────────────────────────────────────────────────

    async def list_banks(self, user_id: int) -> list[UserBankORM]:
        result = await self.db.execute(select(UserBankORM).where(UserBankORM.user_id == user_id))
        return list(result.unique().scalars().all())

    async def add_bank(self, user_id: int, payload: BankCreate) -> UserBankORM:
        bank = UserBankORM(
            user_id=user_id,
            bank_code=payload.bank_code,
            bank_name=payload.bank_name,
        )
        self.db.add(bank)
        await self.db.flush()
        await self.db.refresh(bank)
        return bank

    async def remove_bank(self, bank_id: int, user_id: int) -> bool:
        result = await self.db.execute(
            select(UserBankORM).where(
                UserBankORM.id == bank_id,
                UserBankORM.user_id == user_id,
            )
        )
        bank = result.scalars().first()
        if not bank:
            return False
        await self.db.delete(bank)
        await self.db.flush()
        return True
