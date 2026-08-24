from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from passlib.context import CryptContext

from app.core.database import get_session
from app.db.models.user import UserORM
from app.db.models.user_bank import UserBankORM
from app.schemas.settings import ProfileUpdate, BankCreate

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class SettingsRepository:
    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db

    # ── Profile ───────────────────────────────────────────────

    async def get_or_create_default_user(self) -> UserORM:
        """Return the first user, auto-creating one if none exists.

        LIMITAÇÃO CONHECIDA (single-user): a aplicação não tem autenticação
        multi-usuário. Todo dado é atrelado a um único usuário "default". Isto
        funciona para o caso de uso atual (app pessoal de finanças), mas NÃO
        isola dados entre pessoas.
        TRABALHO FUTURO (multi-user): introduzir `user_id` em todas as queries
        (transacoes, contas_recorrentes, metas, limites, etc.) e escopar os
        repositórios por `user_id`, trocando este método por um
        `get_current_user(user_id)` baseado em auth real.
        """
        result = await self.db.execute(select(UserORM).limit(1))
        user = result.scalars().first()
        if not user:
            user = UserORM(name="", email="", password_hash="")
            self.db.add(user)
            await self.db.commit()
            await self.db.refresh(user)
        return user

    async def update_profile(self, payload: ProfileUpdate) -> UserORM:
        user = await self.get_or_create_default_user()
        if payload.name is not None:
            user.name = payload.name
        if payload.email is not None:
            user.email = payload.email
        if payload.password:
            user.password_hash = pwd_context.hash(payload.password)
        if payload.pluggy_api_key is not None:
            user.pluggy_api_key = payload.pluggy_api_key
        await self.db.commit()
        await self.db.refresh(user)
        return user

    # ── Banks ─────────────────────────────────────────────────

    async def list_banks(self, user_id: int) -> list[UserBankORM]:
        result = await self.db.execute(
            select(UserBankORM).where(UserBankORM.user_id == user_id)
        )
        return list(result.unique().scalars().all())

    async def add_bank(self, user_id: int, payload: BankCreate) -> UserBankORM:
        bank = UserBankORM(
            user_id=user_id,
            bank_code=payload.bank_code,
            bank_name=payload.bank_name,
        )
        self.db.add(bank)
        await self.db.commit()
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
        await self.db.commit()
        return True
