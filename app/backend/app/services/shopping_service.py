"""Shopping-list service: use cases over the authenticated user's shopping items.

Layering (see AGENTS.md): route -> service -> repository. The routes are admin-only (guard on
the router); every repository call still receives ``user.id`` from the verified token. Writes
only flush: the unit of work commits once when the route returns.
"""

from datetime import date

from app.core.errors import NotFoundError
from app.core.unit_of_work import UnitOfWork
from app.db.models.shopping_item import ShoppingItemORM
from app.db.models.user import UserORM
from app.db.repositories.shopping import ShoppingRepository
from app.schemas.shopping import (
    GenerateRecurringShoppingRequest,
    ShoppingItemCreate,
    ShoppingItemUpdate,
)

NOT_FOUND_MESSAGE = "Item não encontrado"


class ShoppingService:
    """Use cases over the authenticated user's shopping items."""

    def __init__(self, uow: UnitOfWork, user: UserORM) -> None:
        """Binds the service to the request's unit of work and authenticated user."""
        self.uow = uow
        self.user = user
        self.repo = ShoppingRepository(uow.session)

    async def list_month(self, month: date, entity_type: str | None) -> list[ShoppingItemORM]:
        """Items of the month plus unchecked leftovers of earlier months (rollover)."""
        return await self.repo.list_by_month(month, entity_type=entity_type, user_id=self.user.id)

    async def create(self, payload: ShoppingItemCreate) -> ShoppingItemORM:
        """Adds an item to the authenticated user's list."""
        return await self.repo.create(payload, self.user.id)

    async def update(self, item_id: int, payload: ShoppingItemUpdate) -> ShoppingItemORM:
        """Updates one of the user's items or raises NotFoundError."""
        item = await self.repo.update(item_id, payload, self.user.id)
        if item is None:
            raise NotFoundError(NOT_FOUND_MESSAGE)
        return item

    async def delete(self, item_id: int) -> ShoppingItemORM:
        """Deletes one of the user's items or raises NotFoundError."""
        item = await self.repo.delete(item_id, self.user.id)
        if item is None:
            raise NotFoundError(NOT_FOUND_MESSAGE)
        return item

    async def generate_recurring(self, payload: GenerateRecurringShoppingRequest) -> int:
        """Copies the user's recurring items into the following months; returns how many."""
        return await self.repo.generate_recurring_items(payload, self.user.id)
