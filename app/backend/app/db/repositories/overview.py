# app/db/repositories/overview.py

import calendar
from typing import Any, Dict, List, Optional
from datetime import date, datetime

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.models.transaction import TransactionORM
from app.db.models.category import CategoryORM
from app.db.repositories.limits import LimitsRepository
from app.db.repositories.goal import MetaRepository
from app.db.repositories.shopping import ShoppingRepository
from app.db.repositories.recurring_account import ContaRecorrenteRepository
from app.schemas.overview import (
    CategoriaStatusOverview,
    CreditCardOverview,
    MonthProgressOverview,
    OverviewResponse,
    ParcelaMesOverview,
    RecorrentePagarOverview,
    TotaisOverview,
)

SPECIAL_CATEGORIAS = {"mensal pf", "mensal pj", "limite cartao credito", "metas"}

# Só exibe no dashboard categorias estouradas ou quase chegando no limite (>=80%)
THRESHOLD_EXIBICAO_CATEGORIA = 80.0


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
    ) -> OverviewResponse:
        mes_start = datetime(year, month, 1)
        if month == 12:
            mes_end = datetime(year + 1, 1, 1)
        else:
            mes_end = datetime(year, month + 1, 1)

        totals = await self._totals(mes_start, mes_end, entity_type, user_id)
        month_progress = await self._month_progress(year, month, entity_type, user_id)
        credit_card = await self._credit_card(mes_start, mes_end, entity_type, user_id)
        categories_status = await self._categories_status(year, month, entity_type, user_id)
        installments = await self._installments(mes_start, mes_end, entity_type, user_id)
        recurring_accounts = await self._recurring_accounts(mes_start, mes_end, entity_type, user_id)

        goals: List[Dict[str, Any]] = []
        shopping: List[Dict[str, Any]] = []
        if is_admin:
            meta_repo = MetaRepository(self.db)
            goals = await meta_repo.calcular_progresso_todas(
                year, month,
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

    async def _totals(self, mes_start: datetime, mes_end: datetime, entity_type: str, user_id: int) -> TotaisOverview:
        stmt_income = select(func.coalesce(func.sum(TransactionORM.amount), 0)).where(
            TransactionORM.user_id == user_id,
            TransactionORM.transaction_date >= mes_start,
            TransactionORM.transaction_date < mes_end,
            TransactionORM.type == "income",
        )
        stmt_expense = select(func.coalesce(func.sum(TransactionORM.amount), 0)).where(
            TransactionORM.user_id == user_id,
            TransactionORM.transaction_date >= mes_start,
            TransactionORM.transaction_date < mes_end,
            TransactionORM.type == "expense",
        )
        stmt_invested = select(func.coalesce(func.sum(TransactionORM.amount), 0)).where(
            TransactionORM.user_id == user_id,
            TransactionORM.transaction_date >= mes_start,
            TransactionORM.transaction_date < mes_end,
            TransactionORM.type == "investment",
        )
        if entity_type != "all":
            stmt_income = stmt_income.where(TransactionORM.entity_type == entity_type)
            stmt_expense = stmt_expense.where(TransactionORM.entity_type == entity_type)
            stmt_invested = stmt_invested.where(TransactionORM.entity_type == entity_type)

        total_income = float((await self.db.execute(stmt_income)).scalar() or 0)
        total_expenses = float((await self.db.execute(stmt_expense)).scalar() or 0)
        total_invested = float((await self.db.execute(stmt_invested)).scalar() or 0)

        return TotaisOverview(
            total_income=round(total_income, 2),
            total_expenses=round(total_expenses, 2),
            total_invested=round(total_invested, 2),
            balance=round(total_income - total_expenses, 2),
        )

    async def _month_progress(self, year: int, month: int, entity_type: str, user_id: int) -> MonthProgressOverview:
        days_in_month = calendar.monthrange(year, month)[1]
        today = date.today()

        # "Até o dia atual no mês" (se o mês consultado é o corrente) senão mês inteiro
        if today.year == year and today.month == month:
            day = today.day
        else:
            day = days_in_month

        cutoff = datetime(year, month, day, 23, 59, 59)
        mes_start = datetime(year, month, 1)

        stmt_income = select(func.coalesce(func.sum(TransactionORM.amount), 0)).where(
            TransactionORM.user_id == user_id,
            TransactionORM.transaction_date >= mes_start,
            TransactionORM.transaction_date <= cutoff,
            TransactionORM.type == "income",
        )
        stmt_expense = select(func.coalesce(func.sum(TransactionORM.amount), 0)).where(
            TransactionORM.user_id == user_id,
            TransactionORM.transaction_date >= mes_start,
            TransactionORM.transaction_date <= cutoff,
            TransactionORM.type == "expense",
        )
        if entity_type != "all":
            stmt_income = stmt_income.where(TransactionORM.entity_type == entity_type)
            stmt_expense = stmt_expense.where(TransactionORM.entity_type == entity_type)

        income = float((await self.db.execute(stmt_income)).scalar() or 0)
        expenses = float((await self.db.execute(stmt_expense)).scalar() or 0)

        return MonthProgressOverview(
            day=day,
            days_in_month=days_in_month,
            percent=round(day / days_in_month, 2),
            income_up_to_today=round(income, 2),
            expenses_up_to_today=round(expenses, 2),
            balance=round(income - expenses, 2),
        )

    async def _credit_card(self, mes_start: datetime, mes_end: datetime, entity_type: str, user_id: int) -> CreditCardOverview:
        # Limite total das categorias "Limite Cartao Credito" no escopo
        lim_stmt = select(func.coalesce(func.sum(CategoryORM.limit), 0)).where(
            CategoryORM.user_id == user_id,
            func.lower(CategoryORM.name) == "limite cartao credito",
        )
        if entity_type != "all":
            lim_stmt = lim_stmt.where(CategoryORM.entity_type == entity_type)
        limit = float((await self.db.execute(lim_stmt)).scalar() or 0)

        # Usado = soma de despesas pagas via crédito no mês
        used_stmt = select(func.coalesce(func.sum(TransactionORM.amount), 0)).where(
            TransactionORM.user_id == user_id,
            TransactionORM.transaction_date >= mes_start,
            TransactionORM.transaction_date < mes_end,
            TransactionORM.type == "expense",
            TransactionORM.payment_method == "credit",
        )
        if entity_type != "all":
            used_stmt = used_stmt.where(TransactionORM.entity_type == entity_type)
        used = float((await self.db.execute(used_stmt)).scalar() or 0)

        percent_used = round((used / limit) * 100, 1) if limit > 0 else 0.0

        return CreditCardOverview(
            limit=round(limit, 2),
            used=round(used, 2),
            remaining=round(limit - used, 2),
            percent_used=percent_used,
        )

    async def _categories_status(self, year: int, month: int, entity_type: str, user_id: int) -> List[CategoriaStatusOverview]:
        limits_repo = LimitsRepository(self.db)
        data = await limits_repo.get_limits_with_spending(
            year, month, user_id, entity_type=(None if entity_type == "all" else entity_type)
        )

        result: List[CategoriaStatusOverview] = []
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

    async def _installments(self, mes_start: datetime, mes_end: datetime, entity_type: str, user_id: int) -> List[ParcelaMesOverview]:
        stmt = (
            select(TransactionORM)
            .where(
                TransactionORM.user_id == user_id,
                TransactionORM.transaction_date >= mes_start,
                TransactionORM.transaction_date < mes_end,
                TransactionORM.type == "expense",
                TransactionORM.is_installment.is_(True),
            )
            .order_by(TransactionORM.transaction_date)
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

    async def _recurring_accounts(self, mes_start: datetime, mes_end: datetime, entity_type: str, user_id: int) -> List[RecorrentePagarOverview]:
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

        result: List[RecorrentePagarOverview] = []
        for c in ativas:
            if c.id not in pagam_no_mes:
                continue
            total = c.total_installments or 12
            remaining = getattr(c, "remaining_installments", 0) or 0
            current = total - remaining + 1
            if current < 1:
                current = 1
            if current > total:
                current = total
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
                    current_installment=current,
                    total_installments=total,
                    remaining_installments=remaining,
                    is_ending_soon=(remaining > 0 and remaining <= 2),
                )
            )
        return result