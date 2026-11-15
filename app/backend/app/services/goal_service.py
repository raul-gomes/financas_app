"""Goals (metas) service: use cases over the authenticated user's goals.

Layering (see AGENTS.md): route -> service -> repository. The routes are admin-only (guard on
the router); every repository call still receives ``user.id`` from the verified token. Writes
only flush: the unit of work commits once when the route returns.
"""

from app.core.errors import NotFoundError
from app.core.unit_of_work import UnitOfWork
from app.db.models.category import SubcategoryORM
from app.db.models.user import UserORM
from app.db.repositories.goal import MetaRepository
from app.schemas.goals import MetaCreate, MetaUpdate

NOT_FOUND_MESSAGE = "Meta não encontrada"


class GoalService:
    """Use cases over the authenticated user's goals."""

    def __init__(self, uow: UnitOfWork, user: UserORM) -> None:
        """Binds the service to the request's unit of work and authenticated user."""
        self.uow = uow
        self.user = user
        self.repo = MetaRepository(uow.session)

    async def list_goals(
        self, completed: bool | None, entity_type: str | None, limit: int, offset: int
    ) -> list[SubcategoryORM]:
        """Lists the user's goals, optionally filtered by completion and nature."""
        return await self.repo.list_metas(
            completed=completed,
            entity_type=entity_type,
            limit=limit,
            offset=offset,
            user_id=self.user.id,
        )

    async def create(self, payload: MetaCreate) -> SubcategoryORM:
        """Creates a goal under the user's "Metas" category.

        Raises:
            ConflictError: when a goal with that name already exists.
        """
        return await self.repo.create_meta(payload, self.user.id)

    async def update(self, goal_id: int, payload: MetaUpdate) -> SubcategoryORM:
        """Updates one of the user's goals or raises NotFoundError."""
        return self._found(await self.repo.update_meta(goal_id, payload, self.user.id))

    async def delete(self, goal_id: int) -> SubcategoryORM:
        """Deletes one of the user's goals or raises NotFoundError."""
        return self._found(await self.repo.delete_meta(goal_id, self.user.id))

    async def complete(self, goal_id: int) -> SubcategoryORM:
        """Marks one of the user's goals as completed today or raises NotFoundError."""
        return self._found(await self.repo.complete_goal(goal_id, self.user.id))

    async def reactivate(self, goal_id: int) -> SubcategoryORM:
        """Reactivates one of the user's completed goals or raises NotFoundError."""
        return self._found(await self.repo.reactivate_goal(goal_id, self.user.id))

    async def progress(
        self, year: int, month: int, completed: bool | None, entity_type: str | None
    ) -> list[dict]:
        """Progress of the user's goals in the month (one grouped query)."""
        return await self.repo.calcular_progresso_todas(
            year, month, completed=completed, entity_type=entity_type, user_id=self.user.id
        )

    @staticmethod
    def _found(goal: SubcategoryORM | None) -> SubcategoryORM:
        """Returns the goal or raises NotFoundError when the repository found none."""
        if goal is None:
            raise NotFoundError(NOT_FOUND_MESSAGE)
        return goal
