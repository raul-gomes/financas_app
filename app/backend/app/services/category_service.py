"""Categories service: use cases over the authenticated user's categories and subcategories.

Layering (see AGENTS.md): route -> service -> repository. Every repository call receives
``user.id`` taken from the verified token. Writes only flush; the unit of work commits once
when the route returns (or rolls back when it raises).
"""

from app.core.errors import NotFoundError
from app.core.unit_of_work import UnitOfWork
from app.db.models.category import CategoryORM
from app.db.models.user import UserORM
from app.db.repositories.category import CategoriaRepository
from app.db.repositories.dashboard import invalidate_opcoes_categorias_cache
from app.schemas.categories import CategoriaCreate, CategoriaUpdate

NOT_FOUND_MESSAGE = "Categoria não encontrada"


async def _invalidate_options_cache() -> None:
    """Drops the cached category options once the change is durable."""
    invalidate_opcoes_categorias_cache()


class CategoryService:
    """Use cases over the authenticated user's categories."""

    def __init__(self, uow: UnitOfWork, user: UserORM) -> None:
        """Binds the service to the request's unit of work and authenticated user."""
        self.uow = uow
        self.user = user
        self.repo = CategoriaRepository(uow.session)

    async def list(self) -> list[CategoryORM]:
        """Returns every category of the user with its subcategories."""
        return await self.repo.get_all(self.user.id)

    async def get(self, category_id: int) -> CategoryORM:
        """Returns one of the user's categories or raises NotFoundError."""
        category = await self.repo.get_by_id(category_id, self.user.id)
        if category is None:
            raise NotFoundError(NOT_FOUND_MESSAGE)
        return category

    async def create(self, payload: CategoriaCreate) -> CategoryORM:
        """Creates a category (and its subcategories) for the authenticated user.

        Raises:
            ConflictError: when the user already has a category with that name and nature.
        """
        category = await self.repo.create(self.user.id, payload)
        self.uow.after_commit(_invalidate_options_cache)
        return category

    async def update(self, category_id: int, payload: CategoriaUpdate) -> CategoryORM:
        """Updates one of the user's categories or raises NotFoundError."""
        category = await self.repo.update(category_id, self.user.id, payload)
        if category is None:
            raise NotFoundError(NOT_FOUND_MESSAGE)
        self.uow.after_commit(_invalidate_options_cache)
        return category

    async def delete(self, category_id: int) -> CategoryORM:
        """Deletes one of the user's categories or raises NotFoundError."""
        category = await self.repo.delete(category_id, self.user.id)
        if category is None:
            raise NotFoundError(NOT_FOUND_MESSAGE)
        self.uow.after_commit(_invalidate_options_cache)
        return category
