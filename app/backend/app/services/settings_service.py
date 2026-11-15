"""Settings service: profile and bank list of the authenticated user.

Layering (see AGENTS.md): route -> service -> repository. Everything is scoped by the user from
the verified token (never a client-sent id). Writes only flush: the unit of work commits once
when the route returns.
"""

from app.core.errors import NotFoundError, ValidationError
from app.core.unit_of_work import UnitOfWork
from app.db.models.user import UserORM
from app.db.models.user_bank import UserBankORM
from app.db.repositories.settings import SettingsRepository
from app.db.repositories.transaction import TransacaoRepository
from app.schemas.settings import BankCreate, ProfileUpdate

BANK_NOT_FOUND_MESSAGE = "Banco não encontrado"
NO_BANKS_MESSAGE = "Nenhum banco cadastrado. Adicione bancos primeiro."


class SettingsService:
    """Use cases over the authenticated user's profile and banks."""

    def __init__(self, uow: UnitOfWork, user: UserORM) -> None:
        """Binds the service to the request's unit of work and authenticated user."""
        self.uow = uow
        self.user = user
        self.repo = SettingsRepository(uow.session)
        self.transactions = TransacaoRepository(uow.session)

    def profile(self) -> UserORM:
        """The authenticated user's own profile."""
        return self.user

    async def update_profile(self, payload: ProfileUpdate) -> UserORM:
        """Updates the user's name and/or Pluggy key (stored encrypted, "" removes it)."""
        return await self.repo.update_profile(self.user.id, payload)

    async def list_banks(self) -> list[UserBankORM]:
        """Banks the user added."""
        return await self.repo.list_banks(self.user.id)

    async def add_bank(self, payload: BankCreate) -> UserBankORM:
        """Adds a bank to the authenticated user's list."""
        return await self.repo.add_bank(self.user.id, payload)

    async def remove_bank(self, bank_id: int) -> None:
        """Removes one of the user's banks or raises NotFoundError."""
        if not await self.repo.remove_bank(bank_id, self.user.id):
            raise NotFoundError(BANK_NOT_FOUND_MESSAGE)

    async def assign_random_banks(self) -> int:
        """Gives a random bank of the user's list to their transactions without one.

        Raises:
            ValidationError: when the user has no banks yet.
        """
        banks = await self.repo.list_banks(self.user.id)
        if not banks:
            raise ValidationError(NO_BANKS_MESSAGE)
        return await self.transactions.assign_random_banks(
            [bank.bank_code for bank in banks], self.user.id
        )
