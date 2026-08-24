# app/db/repositories/limits.py

from typing import List, Dict, Any, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from datetime import datetime

from app.core.database import get_session
from app.db.models.category import CategoryORM, SubcategoryORM
from app.db.models.transaction import TransactionORM

from app.db.repositories.category import CategoriaRepository
from app.db.repositories.subcategory import SubcategoriaRepository
from app.schemas.limits import LimitsUpdatePayload, LimitsUpdateResponse, CategoriaLimiteUpdate
from app.schemas.categories import CategoriaCreate, CategoriaUpdate
from app.schemas.subcategory import SubcategoriaCreate, SubcategoriaUpdate
from app.logger import log_database_operation


class LimitsRepository:
    """
    Repositório especializado para operações em lote de limites de categorias/subcategorias.
    """

    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db
        self.categoria_repo = CategoriaRepository(db)
        self.subcategoria_repo = SubcategoriaRepository(db)

    async def bulk_update_limits(self, payload: LimitsUpdatePayload) -> LimitsUpdateResponse:
        """
        Processa atualizações em lote de limites de categorias e subcategorias.
        """
        log = log_database_operation(
            operation="bulk_update_limits",
            collection="categorias",
            payload=payload.model_dump()
        )

        response = LimitsUpdateResponse(
            success=True,
            message="Limites atualizados com sucesso"
        )

        try:
            # Processa categorias a excluir
            for cat_id in payload.deleted:
                try:
                    cat = await self.categoria_repo.get_by_id(cat_id)
                    if cat:
                        await self.categoria_repo.delete(cat_id)
                        response.deleted_categories += 1
                except Exception as e:
                    response.errors.append(f"Erro ao excluir categoria ID {cat_id}: {str(e)}")
                    log.error(f"Erro ao excluir categoria: {e}")

            # Processa categorias novas
            for new_cat in payload.new:
                try:
                    await self._create_new_category(new_cat, response)
                except Exception as e:
                    response.errors.append(f"Erro ao criar categoria '{new_cat.categoria_nome}': {str(e)}")
                    log.error(f"Erro ao criar categoria: {e}")

            # Processa categorias modificadas
            for mod_cat in payload.modified:
                try:
                    await self._update_existing_category(mod_cat, response)
                except Exception as e:
                    response.errors.append(f"Erro ao atualizar categoria ID {mod_cat.id}: {str(e)}")
                    log.error(f"Erro ao atualizar categoria: {e}")

            # Commit final se não houver erros críticos
            await self.db.commit()

            if response.errors:
                response.success = False
                response.message = f"Operação concluída com {len(response.errors)} erro(s)"

            log.info(f"Bulk update concluído: {response.created_categories} criadas, {response.updated_categories} atualizadas")
            return response

        except Exception as e:
            await self.db.rollback()
            log.error(f"Erro crítico no bulk update: {e}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erro interno ao processar limites: {str(e)}"
            )

    async def _create_new_category(self, new_cat: CategoriaLimiteUpdate, response: LimitsUpdateResponse):
        """Cria uma nova categoria com suas subcategorias."""
        
        # Verifica se já existe categoria com mesmo nome E entity_type
        existing = await self.categoria_repo.get_by_nome_and_entity_type(new_cat.category_name, new_cat.entity_type)
        if existing:
            raise ValueError(f"Categoria '{new_cat.category_name}' com tipo '{new_cat.entity_type}' já existe")

        # Cria a categoria
        categoria_create = CategoriaCreate(
            category_name=new_cat.category_name,
            entity_type=new_cat.entity_type,
            limit=new_cat.limit,
            subcategories=[]  # Vamos criar as subcategorias separadamente
        )

        categoria = await self.categoria_repo.create(categoria_create)
        response.created_categories += 1

        # Cria subcategorias associadas
        for sub_data in new_cat.subcategories:
            if sub_data.subcategory_name.strip():  # Só cria se tiver nome
                sub_create = SubcategoriaCreate(
                    subcategory_name=sub_data.subcategory_name
                )
                await self.subcategoria_repo.create(categoria.id, sub_create)
                response.created_subcategories += 1

    async def _update_existing_category(self, mod_cat: CategoriaLimiteUpdate, response: LimitsUpdateResponse):
        """Atualiza uma categoria existente e suas subcategorias."""
        
        if not mod_cat.id:
            raise ValueError("ID da categoria é obrigatório para atualização")

        # Verifica se a categoria existe
        categoria = await self.categoria_repo.get_by_id(mod_cat.id)
        if not categoria:
            raise ValueError(f"Categoria ID {mod_cat.id} não encontrada")

        # Atualiza campos básicos da categoria
        categoria_update = CategoriaUpdate(
            category_name=mod_cat.category_name,
            entity_type=mod_cat.entity_type,
            limit=mod_cat.limit,
            subcategories=[]  # Processaremos separadamente
        )

        await self.categoria_repo.update(mod_cat.id, categoria_update)
        response.updated_categories += 1

        # Processa subcategorias
        await self._process_subcategories(mod_cat.id, mod_cat.subcategories, response)

    async def _process_subcategories(self, categoria_id: int, subcategorias: List, response: LimitsUpdateResponse):
        """Processa subcategorias de uma categoria (novas e atualizações)."""
        
        for sub_data in subcategorias:
            if not sub_data.subcategory_name.strip():  # Ignora vazias
                continue

            if sub_data.id:
                # Subcategoria existente - atualizar
                sub_update = SubcategoriaUpdate(
                    subcategory_name=sub_data.subcategory_name
                )
                updated_sub = await self.subcategoria_repo.update(sub_data.id, sub_update)
                if updated_sub:
                    response.updated_subcategories += 1
            else:
                # Nova subcategoria - criar
                sub_create = SubcategoriaCreate(
                    subcategory_name=sub_data.subcategory_name
                )
                await self.subcategoria_repo.create(categoria_id, sub_create)
                response.created_subcategories += 1

    async def get_all_limits(self) -> List[Dict[str, Any]]:
        """
        Retorna todas as categorias formatadas para o frontend de limites.
        """
        log = log_database_operation(operation="get_all_limits", collection="categorias")
        
        # Busca todas as categorias com subcategorias
        stmt = select(CategoryORM).order_by(CategoryORM.name)
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
                    {
                        "id": sub.id,
                        "subcategory_name": sub.name
                    }
                    for sub in subcategorias
                ]
            }
            formatted_data.append(categoria_data)

        log.info(f"{len(formatted_data)} categorias recuperadas para limites")
        return formatted_data

    async def get_limits_with_spending(
        self,
        year: int,
        month: int,
        entity_type: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Retorna categorias com limites e gastos para um mês específico.
        
        Args:
            year: Ano (ex: 2024)
            month: Mês (1-12)
            entity_type: Filtrar por 'individual' ou 'business' (None = todos)
        """
        log = log_database_operation(
            operation="get_limits_with_spending",
            collection="categorias",
            year=year,
            month=month,
            entity_type=entity_type
        )

        # Range do mês
        mes_inicio = datetime(year, month, 1)
        if month == 12:
            mes_fim = datetime(year + 1, 1, 1)
        else:
            mes_fim = datetime(year, month + 1, 1)

        # 1. Busca categorias com subcategorias
        stmt = select(CategoryORM).order_by(CategoryORM.name)
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
                    func.coalesce(func.sum(TransactionORM.amount), 0).label("total")
                )
                .where(
                    TransactionORM.subcategory_id.in_(subcategory_ids),
                    TransactionORM.transaction_date >= mes_inicio,
                    TransactionORM.transaction_date < mes_fim,
                    TransactionORM.type == "expense"
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

                subs_response.append({
                    "id": sub.id,
                    "subcategory_name": sub.name,
                    "spent": round(sub_spent, 2),
                    "limit": sub.target_amount  # target_amount pode ser usado como limite da sub
                })

            cat_limit = cat.limit or 0.0
            cat_remaining = cat_limit - cat_spent
            cat_percent = (cat_spent / cat_limit * 100) if cat_limit > 0 else 0.0

            categories_response.append({
                "id": cat.id,
                "category_name": cat.name,
                "entity_type": cat.entity_type,
                "limit": cat_limit,
                "spent": round(cat_spent, 2),
                "remaining": round(cat_remaining, 2),
                "percent_used": round(cat_percent, 1),
                "subcategories": subs_response
            })

            total_limit += cat_limit
            total_spent += cat_spent

        log.info(f"Limites com gastos calculados: {len(categories_response)} categorias")

        return {
            "month": f"{year}-{month:02d}",
            "categories": categories_response,
            "total_limit": round(total_limit, 2),
            "total_spent": round(total_spent, 2),
            "total_remaining": round(total_limit - total_spent, 2)
        }