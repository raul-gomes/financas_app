# app/db/repositories/overview.py

import calendar
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.category import CategoryORM
from app.db.models.transaction import TransactionORM
from app.db.repositories.goal import MetaRepository
from app.db.repositories.limits import LimitsRepository
from app.db.repositories.recurring_account import ContaRecorrenteRepository
from app.db.repositories.shopping import ShoppingRepository
from app.schemas.overview import (
    CategoriaStatusOverview,
    CreditCardOverview,
    MonthProgressOverview,
    OverviewResponse,
    ParcelaMesOverview,
    RecorrentePagarOverview,
    TotaisOverview,
)
from app.services.recurring_installments import DEFAULT_TOTAL_INSTALLMENTS, installment_state

# Categoria cujo limite é o limite do cartão de crédito
CREDIT_CARD_CATEGORY = "limite cartao credito"

SPECIAL_CATEGORIAS = {"mensal pf", "mensal pj", CREDIT_CARD_CATEGORY, "metas"}

# Só exibe no dashboard categorias estouradas ou quase chegando no limite (>=80%)
THRESHOLD_EXIBICAO_CATEGORIA = 80.0


@dataclass(frozen=True)
class MonthAggregates:
    """Month sums computed by a single SQL statement (scope: user + PF/PJ)."""

    income: float
    expenses: float
    invested: float
    income_to_date: float
    expenses_to_date: float
    invested_to_date: float
    credit_used: float
    credit_limit: float


class DashboardOverviewRepository:
    """Repositório do dashboard geral (1 endpoint = 1 tela).

    AGREGADOR: reutiliza os repositórios de limites/metas/compras/recorrentes
    já existentes e agrupa tudo em um único DTO pronto para o frontend.
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    async def overview_geral(
        self,
        year: int,
        month: int,
        entity_type: str,
        user_id: int,
        is_admin: bool = True,
        today: date | None = None,
    ) -> OverviewResponse:
        today = today or date.today()
        mes_start = datetime(year, month, 1)
        mes_end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)

        days_in_month = calendar.monthrange(year, month)[1]
        # "Até o dia atual no mês" (se o mês consultado é o corrente) senão mês inteiro
        day = today.day if today.year == year and today.month == month else days_in_month
        aggregates = await self._month_aggregates(
            mes_start,
            mes_end,
            datetime(year, month, day, 23, 59, 59),
            entity_type,
            user_id,
        )
        totals = self._totals(aggregates)
        month_progress = self._month_progress(aggregates, day, days_in_month)
        credit_card = self._credit_card(aggregates)
        categories_status = await self._categories_status(year, month, entity_type, user_id)
        installments = await self._installments(mes_start, mes_end, entity_type, user_id)
        recurring_accounts = await self._recurring_accounts(
            mes_start, mes_end, entity_type, user_id
        )

        goals: list[dict[str, Any]] = []
        shopping: list[dict[str, Any]] = []
        if is_admin:
            meta_repo = MetaRepository(self.db)
            goals = await meta_repo.calcular_progresso_todas(
                year,
                month,
                entity_type=(None if entity_type == "all" else entity_type),
                user_id=user_id,
            )
            shopping_repo = ShoppingRepository(self.db)
            items = await shopping_repo.list_by_month(
                date(year, month, 1),
                entity_type=(None if entity_type == "all" else entity_type),
                user_id=user_id,
            )
            shopping = [
                {
                    "id": it.id,
                    "name": it.name,
                    "reference_month": str(it.reference_month),
                    "checked": it.checked,
                    "completed_at": str(it.completed_at) if it.completed_at else None,
                    "entity_type": it.entity_type,
                }
                for it in items
            ]

        return OverviewResponse(
            reference_month=f"{month:02d}/{year}",
            entity_type=entity_type,
            totals=totals,
            month_progress=month_progress,
            credit_card=credit_card,
            categories_status=categories_status,
            installments=installments,
            recurring_accounts=recurring_accounts,
            goals=goals,
            shopping=shopping,
        )

    async def _month_aggregates(
        self,
        mes_start: datetime,
        mes_end: datetime,
        cutoff: datetime,
        entity_type: str,
        user_id: int,
    ) -> MonthAggregates:
        """Every month sum the screen needs, aggregated in SQL in a single statement.

        Conditional SUMs (full month, up to ``cutoff``, credit-card usage) plus the card
        limit as a scalar subquery replace what used to be seven separate queries.
        """

        def amount_where(*conditions) -> object:
            return func.coalesce(
                func.sum(case((and_(*conditions), TransactionORM.amount), else_=0.0)), 0.0
            )

        until_cutoff = TransactionORM.transaction_date <= cutoff
        is_income = TransactionORM.type == "income"
        is_expense = TransactionORM.type == "expense"

        limit_subquery = select(func.coalesce(func.sum(CategoryORM.limit), 0.0)).where(
            CategoryORM.user_id == user_id,
            func.lower(CategoryORM.name) == CREDIT_CARD_CATEGORY,
        )
        stmt = select(
            amount_where(is_income).label("income"),
            amount_where(is_expense).label("expenses"),
            amount_where(TransactionORM.type == "investment").label("invested"),
            amount_where(is_income, until_cutoff).label("income_to_date"),
            amount_where(is_expense, until_cutoff).label("expenses_to_date"),
            amount_where(TransactionORM.type == "investment", until_cutoff).label(
                "invested_to_date"
            ),
            amount_where(is_expense, TransactionORM.payment_method == "credit").label(
                "credit_used"
            ),
        ).where(
            TransactionORM.user_id == user_id,
            TransactionORM.transaction_date >= mes_start,
            TransactionORM.transaction_date < mes_end,
        )
        if entity_type != "all":
            stmt = stmt.where(TransactionORM.entity_type == entity_type)
            limit_subquery = limit_subquery.where(CategoryORM.entity_type == entity_type)
        stmt = stmt.add_columns(limit_subquery.scalar_subquery().label("credit_limit"))

        row = (await self.db.execute(stmt)).one()
        return MonthAggregates(
            income=float(row.income),
            expenses=float(row.expenses),
            invested=float(row.invested),
            income_to_date=float(row.income_to_date),
            expenses_to_date=float(row.expenses_to_date),
            invested_to_date=float(row.invested_to_date),
            credit_used=float(row.credit_used),
            credit_limit=float(row.credit_limit or 0),
        )

    @staticmethod
    def _totals(agg: MonthAggregates) -> TotaisOverview:
        """Month totals from the SQL aggregates.

        Saídas (outflows) = expenses + investments; the balance is income minus outflows.
        """
        outflows = agg.expenses + agg.invested
        return TotaisOverview(
            total_income=round(agg.income, 2),
            total_expenses=round(agg.expenses, 2),
            total_invested=round(agg.invested, 2),
            total_outflows=round(outflows, 2),
            balance=round(agg.income - outflows, 2),
        )

    @staticmethod
    def _month_progress(
        agg: MonthAggregates, day: int, days_in_month: int
    ) -> MonthProgressOverview:
        """Progress of the month up to ``day`` from the SQL aggregates."""
        return MonthProgressOverview(
            day=day,
            days_in_month=days_in_month,
            percent=round(day / days_in_month, 2),
            income_up_to_today=round(agg.income_to_date, 2),
            expenses_up_to_today=round(agg.expenses_to_date, 2),
            outflows_up_to_today=round(agg.expenses_to_date + agg.invested_to_date, 2),
            balance=round(agg.income_to_date - agg.expenses_to_date - agg.invested_to_date, 2),
        )

    @staticmethod
    def _credit_card(agg: MonthAggregates) -> CreditCardOverview:
        """Credit-card usage: limit of the "Limite Cartao Credito" categories vs credit spending."""
        limit, used = agg.credit_limit, agg.credit_used
        percent_used = round((used / limit) * 100, 1) if limit > 0 else 0.0
        return CreditCardOverview(
            limit=round(limit, 2),
            used=round(used, 2),
            remaining=round(limit - used, 2),
            percent_used=percent_used,
        )

    async def _categories_status(
        self, year: int, month: int, entity_type: str, user_id: int
    ) -> list[CategoriaStatusOverview]:
        limits_repo = LimitsRepository(self.db)
        data = await limits_repo.get_limits_with_spending(
            year, month, user_id, entity_type=(None if entity_type == "all" else entity_type)
        )

        result: list[CategoriaStatusOverview] = []
        for cat in data["categories"]:
            if cat["limit"] <= 0:
                continue
            if cat["category_name"].lower() in SPECIAL_CATEGORIAS:
                continue
            percent = cat["percent_used"]
            # Dashboard só mostra categorias estouradas ou quase (>=80% do limite)
            if percent < THRESHOLD_EXIBICAO_CATEGORIA:
                continue
            status = "over" if percent >= 100 else "warning"
            result.append(
                CategoriaStatusOverview(
                    id=cat["id"],
                    category_name=cat["category_name"],
                    entity_type=cat["entity_type"],
                    limit=cat["limit"],
                    spent=cat["spent"],
                    remaining=cat["remaining"],
                    percent_used=percent,
                    status=status,
                )
            )
        return result

    async def _installments(
        self, mes_start: datetime, mes_end: datetime, entity_type: str, user_id: int
    ) -> list[ParcelaMesOverview]:
        stmt = (
            select(TransactionORM)
            .where(
                TransactionORM.user_id == user_id,
                TransactionORM.transaction_date >= mes_start,
                TransactionORM.transaction_date < mes_end,
                TransactionORM.type == "expense",
                TransactionORM.is_installment.is_(True),
            )
            .order_by(TransactionORM.transaction_date, TransactionORM.id)
        )
        if entity_type != "all":
            stmt = stmt.where(TransactionORM.entity_type == entity_type)

        txs = (await self.db.execute(stmt)).unique().scalars().all()

        return [
            ParcelaMesOverview(
                id=t.id,
                description=t.description,
                amount=t.amount,
                installment_number=t.installment_number,
                total_installments=t.total_installments,
                category_name=t.category.name if t.category else "",
                subcategory_name=t.subcategory.name if t.subcategory else "",
                payment_method=t.payment_method,
                entity_type=t.entity_type,
                transaction_date=t.transaction_date,
            )
            for t in txs
        ]

    async def _recurring_accounts(
        self, mes_start: datetime, mes_end: datetime, entity_type: str, user_id: int
    ) -> list[RecorrentePagarOverview]:
        repo = ContaRecorrenteRepository(self.db)
        contas = await repo.get_all(
            entity_type=(None if entity_type == "all" else entity_type),
            user_id=user_id,
        )

        # Contas que terão pagamento neste mês (existe transação gerada no mês)
        ativas = [c for c in contas if c.active]
        pagam_no_mes: set = set()
        if ativas:
            ids = [c.id for c in ativas]
            tx_stmt = (
                select(TransactionORM.recurring_account_id)
                .where(
                    TransactionORM.recurring_account_id.in_(ids),
                    TransactionORM.transaction_date >= mes_start,
                    TransactionORM.transaction_date < mes_end,
                )
                .distinct()
            )
            pagam_no_mes = {row[0] for row in (await self.db.execute(tx_stmt)).all()}

        result: list[RecorrentePagarOverview] = []
        for c in ativas:
            if c.id not in pagam_no_mes:
                continue
            remaining = getattr(c, "remaining_installments", 0) or 0
            state = installment_state(c.total_installments, remaining, active=c.active)
            result.append(
                RecorrentePagarOverview(
                    id=c.id,
                    description=c.description,
                    amount=c.amount,
                    due_day=c.due_day,
                    category_name=c.category.name if c.category else "",
                    subcategory_name=c.subcategory.name if c.subcategory else "",
                    entity_type=c.entity_type,
                    payment_method=c.payment_method,
                    current_installment=state.current_installment,
                    total_installments=c.total_installments or DEFAULT_TOTAL_INSTALLMENTS,
                    remaining_installments=remaining,
                    is_ending_soon=state.is_ending_soon,
                )
            )
        return result
