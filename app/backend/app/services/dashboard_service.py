"""Dashboard service: use cases of the overview and financial dashboard screens.

Layering (see AGENTS.md): route -> service -> repository. The service is built per request
from the authenticated user, so every aggregation is scoped by ``user.id`` taken from the
verified token, and the admin-only sections of the overview are decided here from
``user.role`` (never from a client-sent flag). It is read-only: nothing to commit.
"""

from datetime import date, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.user import UserORM
from app.db.repositories.dashboard import DashboardRepository
from app.db.repositories.overview import DashboardOverviewRepository
from app.schemas.dashboard import (
    EntradasPorCategoriaResponse,
    ExtratoResponse,
    OpcoesCategoriaResponse,
    RendimentoPeriodoResponse,
    TipoTrans,
)
from app.schemas.overview import OverviewResponse

ADMIN_ROLE = "admin"


class DashboardService:
    """Read-only dashboard use cases for the authenticated user."""

    def __init__(self, session: AsyncSession, user: UserORM) -> None:
        """Binds the service to the request's session and authenticated user."""
        self.user = user
        self.dashboard = DashboardRepository(session)
        self.overview_repo = DashboardOverviewRepository(session)

    @property
    def is_admin(self) -> bool:
        """Whether the authenticated user has the admin role."""
        return getattr(self.user, "role", "") == ADMIN_ROLE

    async def overview(
        self, year: int, month: int, entity_type: str, today: date | None = None
    ) -> OverviewResponse:
        """Main-screen overview; goals and shopping are only filled for admins."""
        return await self.overview_repo.overview_geral(
            year, month, entity_type, self.user.id, self.is_admin, today=today
        )

    async def statement(
        self,
        start: datetime,
        end: datetime,
        entity_type: str,
        start_label: str,
        end_label: str,
    ) -> ExtratoResponse:
        """Financial statement (totals, goal, limits and chart aggregates) for the period."""
        return await self.dashboard.extrato_financeiro(
            start, end, entity_type, start_label, end_label, self.user.id
        )

    async def period_income(self, year: int, entity_type: str) -> RendimentoPeriodoResponse:
        """Income/expense per month of the year plus the monthly limit."""
        return await self.dashboard.rendimento_por_periodo(year, entity_type, self.user.id)

    async def breakdown_by_category(
        self, start: datetime, end: datetime, entity_type: str, kind: TipoTrans
    ) -> list[dict]:
        """Totals per category/subcategory for income or expense in the period."""
        return await self.dashboard.gastos_por_categoria(
            start, end, entity_type, kind, self.user.id
        )

    async def income_by_subcategory(
        self,
        start: datetime,
        end: datetime,
        entity_type: str,
        start_label: str,
        end_label: str,
    ) -> EntradasPorCategoriaResponse:
        """Income totals per subcategory in the period."""
        return await self.dashboard.entradas_por_categoria(
            start, end, entity_type, start_label, end_label, self.user.id
        )

    async def category_options(
        self, entity_type: str, transaction_type: str | None
    ) -> OpcoesCategoriaResponse:
        """Selectable categories and subcategories of the user."""
        return await self.dashboard.opcoes_categorias(
            entity_type, transaction_type, user_id=self.user.id
        )
