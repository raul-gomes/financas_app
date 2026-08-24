# app/db/repositories/dashboard.py

import calendar
import time
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from app.db.models.transaction import TransactionORM
from app.db.models.category import CategoryORM
from app.schemas.dashboard import CategoriaOpcao, EntradasPorCategoriaResponse, ExtratoResponse, OpcoesCategoriaResponse, RendimentoPeriodoResponse, SubcategoriaOpcao, TipoTrans, TransacaoExtrato
from app.schemas.transaction import NaturezaTransacao, TransacaoResponse

# Simple in-memory cache for opcoes_categorias (key: (entity_type, tipo), value: (timestamp, data))
_opcoes_categorias_cache: Dict[tuple, tuple] = {}
_CACHE_TTL_SECONDS = 300  # 5 minutes

def _invalidate_opcoes_categorias_cache():
    """Invalidates the opcoes_categorias cache."""
    global _opcoes_categorias_cache
    _opcoes_categorias_cache.clear()

def _get_cached_opcoes_categorias(entity_type: str, tipo: Optional[str]) -> Optional[OpcoesCategoriaResponse]:
    """Gets cached opcoes_categorias if not expired."""
    key = (entity_type, tipo or '')
    if key in _opcoes_categorias_cache:
        timestamp, data = _opcoes_categorias_cache[key]
        if time.time() - timestamp < _CACHE_TTL_SECONDS:
            return data
        else:
            del _opcoes_categorias_cache[key]
    return None

def _set_cached_opcoes_categorias(entity_type: str, tipo: Optional[str], data: OpcoesCategoriaResponse):
    """Sets opcoes_categorias in cache with current timestamp."""
    key = (entity_type, tipo or '')
    _opcoes_categorias_cache[key] = (time.time(), data)


class DashboardRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def gastos_por_categoria(
        self,
        start_date: datetime,
        end_date: datetime,
        entity_type: str,
        type: TipoTrans,
    ) -> List[Dict[str, Any]]:
        stmt = (
            select(TransactionORM)
            .where(TransactionORM.transaction_date >= start_date)
            .where(TransactionORM.transaction_date <= end_date)
        )
        if entity_type != 'all':
            stmt = stmt.where(TransactionORM.entity_type == NaturezaTransacao(entity_type))
        stmt = stmt.where(TransactionORM.type == type.value)

        result = await self.db.execute(stmt)
        transacoes = result.unique().scalars().all()

        gastos: Dict[int, Dict[str, Any]] = {}
        for t in transacoes:
            if not t.category or not t.subcategory:
                continue
            cid = t.category.id
            cat_nome = t.category.name
            sub_nome = t.subcategory.name
            limite = t.category.limit

            cat = gastos.setdefault(
                cid,
                {"name": cat_nome, "total": 0.0, "limit": limite, "subcategories": {}},
            )
            cat["total"] += t.amount
            cat["subcategories"].setdefault(sub_nome, 0.0)
            cat["subcategories"][sub_nome] += t.amount

        resultado = []
        for data in gastos.values():
            if data["total"] > 0:
                resultado.append(
                    {
                        "name": data["name"],
                        "total": round(data["total"], 2),
                        "limit": data["limit"],
                        "subcategories": [
                            {"name": sn, "amount": f"{round(v,2):.2f}"}
                            for sn, v in data["subcategories"].items()
                        ],
                    }
                )

        return resultado

    async def rendimento_por_periodo(
        self, 
        ano: int,
        entity_type: str) -> Dict[str, Dict[str, float]]:

        # Single query with GROUP BY month instead of 12 queries
        from sqlalchemy import func as sa_func, extract

        stmt = (
            select(
                extract('month', TransactionORM.transaction_date).label('mes'),
                TransactionORM.type,
                sa_func.sum(TransactionORM.amount).label('total'),
            )
            .where(
                extract('year', TransactionORM.transaction_date) == ano,
            )
        )
        if entity_type != 'all':
            stmt = stmt.where(TransactionORM.entity_type == entity_type)
        stmt = stmt.group_by('mes', TransactionORM.type)

        result = await self.db.execute(stmt)
        rows = result.all()

        meses_data: Dict[str, Dict[str, float]] = {}
        for m in range(1, 13):
            meses_data[calendar.month_name[m].lower()] = {"income": 0.0, "expense": 0.0}

        for row in rows:
            mes_nome = calendar.month_name[int(row.mes)].lower()
            if row.type in ("income", "expense"):
                meses_data[mes_nome][row.type] = round(float(row.total), 2)

        mensal_cat = await self.db.execute(
            select(CategoryORM)
            .where(func.lower(CategoryORM.name) == 'mensal pf')
            .where(CategoryORM.entity_type == 'individual')
        )
        mensal_pf_obj = mensal_cat.scalars().first()

        mensal_pj_cat = await self.db.execute(
            select(CategoryORM)
            .where(func.lower(CategoryORM.name) == 'mensal pj')
            .where(CategoryORM.entity_type == 'business')
        )
        mensal_pj_obj = mensal_pj_cat.scalars().first()

        if entity_type == 'individual':
            limite_mensal = mensal_pf_obj.limit if mensal_pf_obj else 1000.0
        elif entity_type == 'business':
            limite_mensal = mensal_pj_obj.limit if mensal_pj_obj else 1000.0
        else:
            limite_mensal = max(
                (mensal_pf_obj.limit if mensal_pf_obj else 0),
                (mensal_pj_obj.limit if mensal_pj_obj else 0)
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
        end_date_str: str
    ) -> ExtratoResponse:
        stmt = (
            select(TransactionORM)
            .where(TransactionORM.transaction_date >= start_date)
            .where(TransactionORM.transaction_date <= end_date)
        )
        if entity_type != 'all':
            stmt = stmt.where(TransactionORM.entity_type == entity_type)
        stmt = stmt.options(
            selectinload(TransactionORM.recurring_account),
        ).order_by(TransactionORM.transaction_date.desc())
        result = await self.db.execute(stmt)
        transacoes = result.unique().scalars().all()
    
        total_income = sum(t.amount for t in transacoes if t.type == "income")
        total_expenses = sum(t.amount for t in transacoes if t.type == "expense")
    
        txs = [
            TransacaoExtrato(
                id=t.id,
                type=t.type,
                amount=t.amount,
                description=t.description,
                category_id=t.category_id,
                subcategory_id=t.subcategory_id,
                category_name=t.category.name if t.category else "",
                subcategory_name=t.subcategory.name if t.subcategory else "",
                payment_method=t.payment_method,
                installment_number=t.installment_number,
                total_installments=t.total_installments,
                is_installment=t.is_installment,
                entity_type=t.entity_type,
                transaction_date=t.transaction_date,
                recurring_account_id=t.recurring_account_id,
                bank_code=t.bank_code,
            )
            for t in transacoes
        ]

        # Gastos fixos (com recurring_account_id) vs variáveis
        fixed_expenses = sum(t.amount for t in transacoes if t.type == "expense" and t.recurring_account_id is not None)
        variable_expenses = sum(t.amount for t in transacoes if t.type == "expense" and t.recurring_account_id is None)

        # Single query to fetch all needed category limits (avoids N+1)
        # Busca: Mensal PF, Mensal PJ, Limite Cartao Credito
        needed_names = ['Mensal PF', 'Mensal PJ', 'Limite Cartao Credito']
        limits_result = await self.db.execute(
            select(CategoryORM.name, CategoryORM.limit, CategoryORM.entity_type).where(
                func.lower(CategoryORM.name).in_([n.lower() for n in needed_names])
            )
        )
        limits_map = {(row.name.lower(), row.entity_type or ''): row.limit for row in limits_result}

        # Helper to get limit from map
        def _get_limit(name: str, entity: str = '', default: float = 1000.0) -> float:
            return limits_map.get((name.lower(), entity), limits_map.get((name.lower(), ''), default))

        # Meta mensal por entity_type
        if entity_type == 'individual':
            monthly_goal = _get_limit('Mensal PF', 'individual')
        elif entity_type == 'business':
            monthly_goal = _get_limit('Mensal PJ', 'business')
        else:
            monthly_goal = max(
                _get_limit('Mensal PF', 'individual', 0),
                _get_limit('Mensal PJ', 'business', 0)
            )
            if monthly_goal == 0:
                monthly_goal = 1000.0

        credit_card_limit = _get_limit('Limite Cartao Credito', entity_type if entity_type != 'all' else '', 0)

        total_invested = sum(t.amount for t in transacoes if t.type == "investment")

        return ExtratoResponse(
            total_income=total_income,
            total_expenses=total_expenses,
            start_date=start_date_str,
            end_date=end_date_str,
            monthly_goal=monthly_goal,
            total_invested=total_invested,
            transactions=txs,
            credit_card_limit=credit_card_limit,
            fixed_expenses=fixed_expenses,
            variable_expenses=variable_expenses,
        )

    async def opcoes_categorias(self, entity_type: str = 'all', tipo: Optional[str] = None) -> OpcoesCategoriaResponse:
        # Check cache first
        cached = _get_cached_opcoes_categorias(entity_type, tipo)
        if cached is not None:
            return cached

        stmt = select(CategoryORM)
        if entity_type != 'all':
            stmt = stmt.where(CategoryORM.entity_type == NaturezaTransacao(entity_type))
        if tipo:
            stmt = stmt.where(
                or_(CategoryORM.type == tipo, CategoryORM.type.is_(None))
            )
        result = await self.db.execute(stmt)
        categorias = result.unique().scalars().all()

        opcoes: List[CategoriaOpcao] = []
        for categoria in categorias:
            subs = [
                SubcategoriaOpcao(
                    id=sub.id,
                    name=sub.name
                )
                for sub in categoria.subcategories
            ]
            opcoes.append(
                CategoriaOpcao(
                    id=categoria.id,
                    name=categoria.name,
                    type=categoria.type,
                    subcategories=subs
                )
            )

        response = OpcoesCategoriaResponse(options=opcoes)
        _set_cached_opcoes_categorias(entity_type, tipo, response)
        return response

    async def entradas_por_categoria(
        self, 
        start_date: datetime, 
        end_date: datetime, 
        entity_type: str,
        start_date_str: str,
        end_date_str: str
    ) -> EntradasPorCategoriaResponse:
        
        # Buscar transações de entrada com subcategoria carregada
        stmt = (
            select(TransactionORM)
            .where(TransactionORM.transaction_date >= start_date)
            .where(TransactionORM.transaction_date <= end_date)
            .where(TransactionORM.type == "income")
        )
        if entity_type != 'all':
            stmt = stmt.where(TransactionORM.entity_type == entity_type)
        
        result = await self.db.execute(stmt)
        transacoes = result.unique().scalars().all()
        
        # Agrupar por subcategoria
        subs: Dict[str, float] = {}
        for transacao in transacoes:
            sub_nome = transacao.subcategory.name if transacao.subcategory else 'Sem subcategoria'
            subs[sub_nome] = subs.get(sub_nome, 0.0) + transacao.amount
        
        output = [
            {'name': nome, 'total': round(valor, 2)}
            for nome, valor in sorted(subs.items(), key=lambda x: x[1], reverse=True)
        ]
        
        return EntradasPorCategoriaResponse(
            start_date=start_date_str,
            end_date=end_date_str,
            subcategories=output
        )

