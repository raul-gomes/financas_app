# app/db/repositories/limits.py

from datetime import datetime
from typing import Any

from fastapi import Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.db.models.category import CategoryORM, SubcategoryORM
from app.db.models.transaction import TransactionORM
from app.logger import log_database_operation


class LimitsRepository:
    """
    Repositório de leitura dos limites de categorias/subcategorias e dos gastos do mês.

    As escritas em lote ficam no ``LimitsService`` (regra de negócio + unit of work).
    """

    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db

    async def get_all_limits(self, user_id: int) -> list[dict[str, Any]]:
        """
        Retorna todas as categorias formatadas para o frontend de limites.
        """
        log = log_database_operation(
            operation="get_all_limits", collection="categorias", user_id=user_id
        )

        # Busca todas as categorias com subcategorias
        stmt = select(CategoryORM).where(CategoryORM.user_id == user_id).order_by(CategoryORM.name)
        result = await self.db.execute(stmt)
        categorias = result.unique().scalars().all()

        # Formata para o frontend
        formatted_data = []
        for cat in categorias:
            # Busca subcategorias da categoria
            sub_stmt = select(SubcategoryORM).where(SubcategoryORM.category_id == cat.id)
            sub_result = await self.db.execute(sub_stmt)
            subcategorias = sub_result.unique().scalars().all()

            categoria_data = {
                "id": cat.id,
                "category_name": cat.name,
                "entity_type": cat.entity_type,
                "limit": cat.limit,
                "subcategories": [
                    {"id": sub.id, "subcategory_name": sub.name} for sub in subcategorias
                ],
            }
            formatted_data.append(categoria_data)

        log.info(f"{len(formatted_data)} categorias recuperadas para limites")
        return formatted_data

    async def get_limits_with_spending(
        self, year: int, month: int, user_id: int, entity_type: str | None = None
    ) -> dict[str, Any]:
        """
        Retorna categorias com limites e gastos para um mês específico.

        Args:
            year: Ano (ex: 2024)
            month: Mês (1-12)
            user_id: Id do usuário autenticado
            entity_type: Filtrar por 'individual' ou 'business' (None = todos)
        """
        log = log_database_operation(
            operation="get_limits_with_spending",
            collection="categorias",
            year=year,
            month=month,
            entity_type=entity_type,
            user_id=user_id,
        )

        # Range do mês
        mes_inicio = datetime(year, month, 1)
        mes_fim = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)

        # 1. Busca categorias com subcategorias
        stmt = select(CategoryORM).where(CategoryORM.user_id == user_id).order_by(CategoryORM.name)
        if entity_type:
            stmt = stmt.where(CategoryORM.entity_type == entity_type)
        result = await self.db.execute(stmt)
        categorias = result.unique().scalars().all()

        # Coleta IDs de subcategorias para query de gastos
        subcategory_ids = []
        for cat in categorias:
            for sub in cat.subcategories:
                subcategory_ids.append(sub.id)

        # 2. Busca gastos agrupados por subcategoria (1 query)
        spent_map = {}
        if subcategory_ids:
            spent_result = await self.db.execute(
                select(
                    TransactionORM.subcategory_id,
                    func.coalesce(func.sum(TransactionORM.amount), 0).label("total"),
                )
                .where(
                    TransactionORM.subcategory_id.in_(subcategory_ids),
                    TransactionORM.transaction_date >= mes_inicio,
                    TransactionORM.transaction_date < mes_fim,
                    TransactionORM.type == "expense",
                )
                .group_by(TransactionORM.subcategory_id)
            )
            spent_map = {row.subcategory_id: float(row.total) for row in spent_result}

        # 3. Monta resposta
        categories_response = []
        total_limit = 0.0
        total_spent = 0.0

        for cat in categorias:
            cat_spent = 0.0
            subs_response = []

            for sub in cat.subcategories:
                sub_spent = spent_map.get(sub.id, 0.0)
                cat_spent += sub_spent

                subs_response.append(
                    {
                        "id": sub.id,
                        "subcategory_name": sub.name,
                        "spent": round(sub_spent, 2),
                        "limit": sub.target_amount,  # target_amount pode ser usado como limite da sub
                    }
                )

            cat_limit = cat.limit or 0.0
            cat_remaining = cat_limit - cat_spent
            cat_percent = (cat_spent / cat_limit * 100) if cat_limit > 0 else 0.0

            categories_response.append(
                {
                    "id": cat.id,
                    "category_name": cat.name,
                    "entity_type": cat.entity_type,
                    "limit": cat_limit,
                    "spent": round(cat_spent, 2),
                    "remaining": round(cat_remaining, 2),
                    "percent_used": round(cat_percent, 1),
                    "subcategories": subs_response,
                }
            )

            total_limit += cat_limit
            total_spent += cat_spent

        log.info(f"Limites com gastos calculados: {len(categories_response)} categorias")

        return {
            "month": f"{year}-{month:02d}",
            "categories": categories_response,
            "total_limit": round(total_limit, 2),
            "total_spent": round(total_spent, 2),
            "total_remaining": round(total_limit - total_spent, 2),
        }
