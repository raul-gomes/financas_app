# app/db/repositories/dashboard.py

import calendar
import time
from datetime import datetime
from typing import Any

from sqlalchemy import Select, case, extract, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.category import CategoryORM, SubcategoryORM
from app.db.models.transaction import TransactionORM
from app.db.models.user_bank import UserBankORM
from app.schemas.dashboard import (
    CategoriaOpcao,
    EntradasPorCategoriaResponse,
    ExtratoResponse,
    OpcoesCategoriaResponse,
    ParcelasAPagar,
    ParcelasBanco,
    RendimentoPeriodoResponse,
    SubcategoriaOpcao,
    TipoTrans,
    TotalBanco,
    TotalDiario,
    TotalFormaPagamento,
)
from app.schemas.transaction import NaturezaTransacao

# Categorias de configuração (orçamento mensal / limite do cartão) que não podem ser
# selecionadas como categoria de uma transação — só existem para alimentar o dashboard.
CATEGORIAS_CONFIGURACAO = {"mensal pf", "mensal pj", "limite cartao credito"}

# Label for income whose subcategory is missing
SEM_SUBCATEGORIA = "Sem subcategoria"

# Label for installments paid without a registered bank
SEM_BANCO = "Sem banco"
MONEY_DECIMALS = 2


def _sum_where(condition):
    """SUM(amount) of the rows matching ``condition`` (0 when none), as one SQL aggregate."""
    return func.coalesce(func.sum(case((condition, TransactionORM.amount), else_=0.0)), 0.0)


# Simple in-memory cache for opcoes_categorias (key: (entity_type, tipo), value: (timestamp, data))
_opcoes_categorias_cache: dict[tuple, tuple] = {}
_CACHE_TTL_SECONDS = 300  # 5 minutes


def invalidate_opcoes_categorias_cache():
    """Invalidates the opcoes_categorias cache."""
    global _opcoes_categorias_cache
    _opcoes_categorias_cache.clear()


def _get_cached_opcoes_categorias(
    entity_type: str, tipo: str | None, user_id: int
) -> OpcoesCategoriaResponse | None:
    """Gets cached opcoes_categorias if not expired."""
    key = (entity_type, tipo or "", user_id)
    if key in _opcoes_categorias_cache:
        timestamp, data = _opcoes_categorias_cache[key]
        if time.time() - timestamp < _CACHE_TTL_SECONDS:
            return data
        else:
            del _opcoes_categorias_cache[key]
    return None


def _set_cached_opcoes_categorias(
    entity_type: str, tipo: str | None, user_id: int, data: OpcoesCategoriaResponse
):
    """Sets opcoes_categorias in cache with current timestamp."""
    key = (entity_type, tipo or "", user_id)
    _opcoes_categorias_cache[key] = (time.time(), data)


class DashboardRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    @staticmethod
    def _scope_transactions(
        stmt: Select,
        start_date: datetime,
        end_date: datetime,
        entity_type: str,
        user_id: int,
    ) -> Select:
        """Restricts a transactions statement to the user, the date range and PF/PJ scope."""
        stmt = stmt.where(
            TransactionORM.user_id == user_id,
            TransactionORM.transaction_date >= start_date,
            TransactionORM.transaction_date <= end_date,
        )
        if entity_type != "all":
            stmt = stmt.where(TransactionORM.entity_type == NaturezaTransacao(entity_type).value)
        return stmt

    async def gastos_por_categoria(
        self,
        start_date: datetime,
        end_date: datetime,
        entity_type: str,
        type: TipoTrans,
        user_id: int,
    ) -> list[dict[str, Any]]:
        """Totals per category and subcategory, aggregated in SQL (1 query).

        Categories and subcategories keep the order of their first transaction (lowest id),
        like the former row-by-row implementation.
        """
        stmt = self._scope_transactions(
            select(
                CategoryORM.id.label("category_id"),
                CategoryORM.name.label("category_name"),
                CategoryORM.limit.label("category_limit"),
                SubcategoryORM.name.label("subcategory_name"),
                func.sum(TransactionORM.amount).label("total"),
                func.min(TransactionORM.id).label("first_id"),
            )
            .select_from(TransactionORM)
            .join(CategoryORM, TransactionORM.category_id == CategoryORM.id)
            .join(SubcategoryORM, TransactionORM.subcategory_id == SubcategoryORM.id),
            start_date,
            end_date,
            entity_type,
            user_id,
        )
        stmt = (
            stmt.where(TransactionORM.type == type.value)
            .group_by(
                CategoryORM.id,
                CategoryORM.name,
                CategoryORM.limit,
                SubcategoryORM.name,
            )
            .order_by(func.min(TransactionORM.id))
        )
        rows = (await self.db.execute(stmt)).all()

        gastos: dict[int, dict[str, Any]] = {}
        for row in rows:
            cat = gastos.setdefault(
                row.category_id,
                {
                    "name": row.category_name,
                    "total": 0.0,
                    "limit": row.category_limit,
                    "subcategories": {},
                },
            )
            cat["total"] += row.total
            cat["subcategories"][row.subcategory_name] = float(row.total)

        return [
            {
                "name": data["name"],
                "total": round(data["total"], 2),
                "limit": data["limit"],
                "subcategories": [
                    {"name": name, "amount": f"{round(value, 2):.2f}"}
                    for name, value in data["subcategories"].items()
                ],
            }
            for data in gastos.values()
            if data["total"] > 0
        ]

    async def rendimento_por_periodo(
        self, ano: int, entity_type: str, user_id: int
    ) -> dict[str, dict[str, float]]:

        # Single query with GROUP BY month; a date range (not extract(year)) keeps it index-friendly
        stmt = select(
            extract("month", TransactionORM.transaction_date).label("mes"),
            TransactionORM.type,
            func.sum(TransactionORM.amount).label("total"),
        ).where(
            TransactionORM.transaction_date >= datetime(ano, 1, 1),
            TransactionORM.transaction_date < datetime(ano + 1, 1, 1),
            TransactionORM.user_id == user_id,
        )
        if entity_type != "all":
            stmt = stmt.where(TransactionORM.entity_type == entity_type)
        stmt = stmt.group_by("mes", TransactionORM.type)

        result = await self.db.execute(stmt)
        rows = result.all()

        meses_data: dict[str, dict[str, float]] = {}
        for m in range(1, 13):
            meses_data[calendar.month_name[m].lower()] = {"income": 0.0, "expense": 0.0}

        for row in rows:
            mes_nome = calendar.month_name[int(row.mes)].lower()
            if row.type in ("income", "expense"):
                meses_data[mes_nome][row.type] = round(float(row.total), 2)

        mensal_cat = await self.db.execute(
            select(CategoryORM)
            .where(func.lower(CategoryORM.name) == "mensal pf")
            .where(CategoryORM.entity_type == "individual")
            .where(CategoryORM.user_id == user_id)
        )
        mensal_pf_obj = mensal_cat.scalars().first()

        mensal_pj_cat = await self.db.execute(
            select(CategoryORM)
            .where(func.lower(CategoryORM.name) == "mensal pj")
            .where(CategoryORM.entity_type == "business")
            .where(CategoryORM.user_id == user_id)
        )
        mensal_pj_obj = mensal_pj_cat.scalars().first()

        if entity_type == "individual":
            limite_mensal = mensal_pf_obj.limit if mensal_pf_obj else 1000.0
        elif entity_type == "business":
            limite_mensal = mensal_pj_obj.limit if mensal_pj_obj else 1000.0
        else:
            limite_mensal = max(
                (mensal_pf_obj.limit if mensal_pf_obj else 0),
                (mensal_pj_obj.limit if mensal_pj_obj else 0),
            )
            if limite_mensal == 0:
                limite_mensal = 1000.0

        return RendimentoPeriodoResponse(limit=limite_mensal, months=meses_data)

    async def extrato_financeiro(
        self,
        start_date: datetime,
        end_date: datetime,
        entity_type: str,
        start_date_str: str,
        end_date_str: str,
        user_id: int,
    ) -> ExtratoResponse:
        # Every total is aggregated in SQL (1 query); the period's rows are served by the
        # paginated transactions list, never by the statement.
        is_expense = TransactionORM.type == "expense"
        totals_stmt = self._scope_transactions(
            select(
                _sum_where(TransactionORM.type == "income").label("income"),
                _sum_where(is_expense).label("expenses"),
                _sum_where(TransactionORM.type == "investment").label("invested"),
                _sum_where(is_expense & TransactionORM.recurring_account_id.is_not(None)).label(
                    "fixed"
                ),
                _sum_where(is_expense & TransactionORM.recurring_account_id.is_(None)).label(
                    "variable"
                ),
            ),
            start_date,
            end_date,
            entity_type,
            user_id,
        )
        totals = (await self.db.execute(totals_stmt)).one()
        aggregates = await self._statement_aggregates(start_date, end_date, entity_type, user_id)
        total_income = float(totals.income)
        total_expenses = float(totals.expenses)
        total_invested = float(totals.invested)
        fixed_expenses = float(totals.fixed)
        variable_expenses = float(totals.variable)

        # Single query to fetch all needed category limits (avoids N+1)
        # Busca: Mensal PF, Mensal PJ, Limite Cartao Credito
        needed_names = ["Mensal PF", "Mensal PJ", "Limite Cartao Credito"]
        limits_result = await self.db.execute(
            select(CategoryORM.name, CategoryORM.limit, CategoryORM.entity_type).where(
                func.lower(CategoryORM.name).in_([n.lower() for n in needed_names]),
                CategoryORM.user_id == user_id,
            )
        )
        limits_map = {(row.name.lower(), row.entity_type or ""): row.limit for row in limits_result}

        # Helper to get limit from map
        def _get_limit(name: str, entity: str = "", default: float = 1000.0) -> float:
            return limits_map.get(
                (name.lower(), entity), limits_map.get((name.lower(), ""), default)
            )

        # Meta mensal por entity_type
        if entity_type == "individual":
            monthly_goal = _get_limit("Mensal PF", "individual")
        elif entity_type == "business":
            monthly_goal = _get_limit("Mensal PJ", "business")
        else:
            monthly_goal = max(
                _get_limit("Mensal PF", "individual", 0), _get_limit("Mensal PJ", "business", 0)
            )
            if monthly_goal == 0:
                monthly_goal = 1000.0

        credit_card_limit = _get_limit(
            "Limite Cartao Credito", entity_type if entity_type != "all" else "", 0
        )

        return ExtratoResponse(
            total_income=total_income,
            total_expenses=total_expenses,
            start_date=start_date_str,
            end_date=end_date_str,
            monthly_goal=monthly_goal,
            total_invested=total_invested,
            credit_card_limit=credit_card_limit,
            fixed_expenses=fixed_expenses,
            variable_expenses=variable_expenses,
            **aggregates,
        )

    async def _statement_aggregates(
        self,
        start_date: datetime,
        end_date: datetime,
        entity_type: str,
        user_id: int,
    ) -> dict[str, Any]:
        """Chart aggregates of the period from ONE grouped query (never from the ORM rows).

        Groups by day, type, payment method, bank and installment flag (a few dozen cells at
        most), then folds the cells into the daily totals, per-payment-method and per-bank
        expenses and the installments still to pay. Bank names come from the user's own banks.
        """
        remaining = func.coalesce(TransactionORM.total_installments, 1) - func.coalesce(
            TransactionORM.installment_number, 1
        )
        day = func.date(TransactionORM.transaction_date)
        stmt = self._scope_transactions(
            select(
                day.label("day"),
                TransactionORM.type,
                TransactionORM.payment_method,
                TransactionORM.bank_code,
                TransactionORM.is_installment,
                func.sum(TransactionORM.amount).label("amount"),
                func.sum(remaining * TransactionORM.amount).label("remaining_amount"),
                func.sum(remaining).label("remaining_count"),
                func.count().label("transactions"),
            ),
            start_date,
            end_date,
            entity_type,
            user_id,
        ).group_by(
            day,
            TransactionORM.type,
            TransactionORM.payment_method,
            TransactionORM.bank_code,
            TransactionORM.is_installment,
        )
        cells = (await self.db.execute(stmt)).all()

        daily: dict[str, dict[str, float]] = {}
        by_method: dict[str, float] = {}
        by_bank: dict[tuple[str, str], float] = {}
        installments: dict[str | None, list[float]] = {}  # bank -> [amount, count, transactions]
        daily_key = {"income": "income", "expense": "expenses", "investment": "investment"}
        for cell in cells:
            amount = float(cell.amount)
            totals = daily.setdefault(
                str(cell.day), {"income": 0.0, "expenses": 0.0, "investment": 0.0}
            )
            totals[daily_key[cell.type]] += amount
            if cell.type != "expense":
                continue
            by_method[cell.payment_method] = by_method.get(cell.payment_method, 0.0) + amount
            if cell.bank_code:
                key = (cell.payment_method, cell.bank_code)
                by_bank[key] = by_bank.get(key, 0.0) + amount
            if cell.is_installment:
                bucket = installments.setdefault(cell.bank_code or None, [0.0, 0, 0])
                bucket[0] += float(cell.remaining_amount or 0)
                bucket[1] += int(cell.remaining_count or 0)
                bucket[2] += int(cell.transactions)

        bank_codes = {code for _, code in by_bank} | {c for c in installments if c is not None}
        names = await self._bank_names(user_id, bank_codes)

        def money(value: float) -> float:
            return round(value, MONEY_DECIMALS)

        return {
            "daily_totals": [
                TotalDiario(date=d, **{k: money(v) for k, v in daily[d].items()})
                for d in sorted(daily)
            ],
            "expenses_by_payment_method": [
                TotalFormaPagamento(payment_method=method, total=money(by_method[method]))
                for method in sorted(by_method)
            ],
            "expenses_by_bank": [
                TotalBanco(
                    payment_method=method,
                    bank_code=code,
                    bank_name=names.get(code, code),
                    total=money(by_bank[(method, code)]),
                )
                for method, code in sorted(by_bank)
            ],
            "installments_due": ParcelasAPagar(
                remaining_amount=money(sum(b[0] for b in installments.values())),
                remaining_installments=sum(b[1] for b in installments.values()),
                transactions=sum(b[2] for b in installments.values()),
                by_bank=[
                    ParcelasBanco(
                        bank_code=code,
                        bank_name=names.get(code, code) if code else SEM_BANCO,
                        remaining_amount=money(bucket[0]),
                        remaining_installments=bucket[1],
                        transactions=bucket[2],
                    )
                    for code, bucket in sorted(installments.items(), key=lambda kv: kv[0] or "")
                ],
            ),
        }

    async def _bank_names(self, user_id: int, codes: set[str]) -> dict[str, str]:
        """Names of the user's own banks for ``codes`` (another user's banks never count)."""
        if not codes:
            return {}
        result = await self.db.execute(
            select(UserBankORM.bank_code, UserBankORM.bank_name)
            .where(UserBankORM.user_id == user_id, UserBankORM.bank_code.in_(codes))
            .order_by(UserBankORM.id)
        )
        names: dict[str, str] = {}
        for code, name in result.all():
            names.setdefault(code, name)
        return names

    async def opcoes_categorias(
        self, entity_type: str = "all", tipo: str | None = None, *, user_id: int
    ) -> OpcoesCategoriaResponse:
        # Check cache first
        cached = _get_cached_opcoes_categorias(entity_type, tipo, user_id)
        if cached is not None:
            return cached

        stmt = select(CategoryORM).where(CategoryORM.user_id == user_id)
        if entity_type != "all":
            stmt = stmt.where(CategoryORM.entity_type == NaturezaTransacao(entity_type))
        if tipo:
            stmt = stmt.where(or_(CategoryORM.type == tipo, CategoryORM.type.is_(None)))
        result = await self.db.execute(stmt)
        categorias = result.unique().scalars().all()

        opcoes: list[CategoriaOpcao] = []
        for categoria in categorias:
            if categoria.name.strip().lower() in CATEGORIAS_CONFIGURACAO:
                continue
            subs = [SubcategoriaOpcao(id=sub.id, name=sub.name) for sub in categoria.subcategories]
            opcoes.append(
                CategoriaOpcao(
                    id=categoria.id, name=categoria.name, type=categoria.type, subcategories=subs
                )
            )

        response = OpcoesCategoriaResponse(options=opcoes)
        _set_cached_opcoes_categorias(entity_type, tipo, user_id, response)
        return response

    async def entradas_por_categoria(
        self,
        start_date: datetime,
        end_date: datetime,
        entity_type: str,
        start_date_str: str,
        end_date_str: str,
        user_id: int,
    ) -> EntradasPorCategoriaResponse:

        # Aggregated in SQL (1 query, one row per subcategory name), in order of first transaction
        stmt = self._scope_transactions(
            select(
                SubcategoryORM.name.label("name"),
                func.sum(TransactionORM.amount).label("total"),
            )
            .select_from(TransactionORM)
            .outerjoin(SubcategoryORM, TransactionORM.subcategory_id == SubcategoryORM.id),
            start_date,
            end_date,
            entity_type,
            user_id,
        )
        stmt = (
            stmt.where(TransactionORM.type == "income")
            .group_by(SubcategoryORM.name)
            .order_by(func.min(TransactionORM.id))
        )
        rows = (await self.db.execute(stmt)).all()

        totals: dict[str, float] = {}
        for row in rows:
            name = row.name or SEM_SUBCATEGORIA
            totals[name] = totals.get(name, 0.0) + float(row.total)
        # sorted() is stable: ties keep the order of the first transaction
        output = [
            {"name": name, "total": round(value, 2)}
            for name, value in sorted(totals.items(), key=lambda item: item[1], reverse=True)
        ]

        return EntradasPorCategoriaResponse(
            start_date=start_date_str, end_date=end_date_str, subcategories=output
        )
