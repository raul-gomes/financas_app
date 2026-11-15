"""Recurring-accounts service: use cases over the authenticated user's recurring accounts.

Layering (see AGENTS.md): route -> service -> repository. Every repository call receives
``user.id`` from the verified token. Writes only flush: the unit of work commits once when the
route returns, and the limit-alert evaluation runs after that commit.
"""

from app.core.errors import NotFoundError, UnprocessableError
from app.core.unit_of_work import UnitOfWork
from app.db.models.recurring_account import RecurringAccountORM
from app.db.models.user import UserORM
from app.db.repositories.category import CategoriaRepository
from app.db.repositories.recurring_account import ContaRecorrenteRepository
from app.db.repositories.subcategory import SubcategoriaRepository
from app.schemas.categories import CategoriaCreate
from app.schemas.recurring_account import (
    ContaRecorrenteCreate,
    ContaRecorrenteUpdate,
)
from app.schemas.subcategory import SubcategoriaCreate

NOT_FOUND_MESSAGE = "Conta recorrente nao encontrada"
CATEGORY_REQUIRED_MESSAGE = "category_id or category_name is required"
SUBCATEGORY_REQUIRED_MESSAGE = "subcategory_id or subcategory_name is required"
AUTO_CATEGORY_TYPE = "expense"


class RecurringAccountService:
    """Use cases over the authenticated user's recurring accounts."""

    def __init__(self, uow: UnitOfWork, user: UserORM) -> None:
        """Binds the service to the request's unit of work and authenticated user."""
        self.uow = uow
        self.user = user
        self.repo = ContaRecorrenteRepository(uow.session)
        self.categories = CategoriaRepository(uow.session)
        self.subcategories = SubcategoriaRepository(uow.session)

    async def create(self, payload: ContaRecorrenteCreate) -> RecurringAccountORM:
        """Creates the account (category/subcategory resolved or created by name) and its
        monthly installments."""
        await self._resolve_category_and_subcategory(payload)
        return await self.repo.create(payload, self.user.id)

    async def list_accounts(
        self, entity_type: str | None, limit: int, offset: int
    ) -> list[RecurringAccountORM]:
        """Lists the user's accounts, newest start date first."""
        return await self.repo.get_all(
            entity_type=entity_type, limit=limit, offset=offset, user_id=self.user.id
        )

    async def get(self, account_id: int) -> RecurringAccountORM:
        """Returns one of the user's accounts or raises NotFoundError."""
        return self._found(await self.repo.get_by_id(account_id, self.user.id))

    async def update(self, account_id: int, payload: ContaRecorrenteUpdate) -> RecurringAccountORM:
        """Updates one of the user's accounts or raises NotFoundError.

        Deactivating the account cancels its future transactions.
        """
        if payload.category_name or payload.subcategory_name:
            await self._resolve_category_and_subcategory(payload)
        return self._found(await self.repo.update(account_id, payload, self.user.id))

    async def delete(self, account_id: int) -> RecurringAccountORM:
        """Deletes one of the user's accounts and its transactions, or raises NotFoundError."""
        return self._found(await self.repo.delete(account_id, self.user.id))

    async def renew(self, account_id: int) -> RecurringAccountORM:
        """Reactivates one of the user's accounts and generates 12 more installments."""
        return self._found(await self.repo.renew(account_id, self.user.id))

    async def _resolve_category_and_subcategory(
        self, payload: ContaRecorrenteCreate | ContaRecorrenteUpdate
    ) -> None:
        """Fills ``category_id``/``subcategory_id`` from the names, creating what is missing.

        Raises:
            UnprocessableError: when neither an id nor a name is given for either level.
        """
        user_id = self.user.id
        category_id = payload.category_id
        if category_id is None:
            if not payload.category_name:
                raise UnprocessableError(CATEGORY_REQUIRED_MESSAGE)
            category = await self.categories.get_by_nome(payload.category_name, user_id)
            if category is None:
                category = await self.categories.create(
                    user_id,
                    CategoriaCreate(
                        category_name=payload.category_name,
                        entity_type=payload.entity_type,
                        limit=0,
                        type=AUTO_CATEGORY_TYPE,
                    ),
                )
            category_id = category.id

        subcategory_id = payload.subcategory_id
        if subcategory_id is None:
            if not payload.subcategory_name:
                raise UnprocessableError(SUBCATEGORY_REQUIRED_MESSAGE)
            subcategory = await self.subcategories.get_by_nome_and_categoria(
                payload.subcategory_name, category_id, user_id
            )
            if subcategory is None:
                subcategory = await self.subcategories.create(
                    category_id,
                    user_id,
                    SubcategoriaCreate(subcategory_name=payload.subcategory_name),
                )
            subcategory_id = subcategory.id

        payload.category_id = category_id
        payload.subcategory_id = subcategory_id

    @staticmethod
    def _found(account: RecurringAccountORM | None) -> RecurringAccountORM:
        """Returns the account or raises NotFoundError when the repository found none."""
        if account is None:
            raise NotFoundError(NOT_FOUND_MESSAGE)
        return account
