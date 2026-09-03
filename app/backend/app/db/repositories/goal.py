# app/db/repositories/meta.py

from typing import List, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from datetime import date

from app.core.database import get_session
from app.db.models.category import CategoryORM, SubcategoryORM
from app.db.models.transaction import TransactionORM
from app.schemas.goals import MetaCreate, MetaUpdate
from app.logger import log_database_operation


METAS_CATEGORIA_NOME = "Metas"


class MetaRepository:
    """
    Repositório para operações com Metas.
    Metas são subcategorias com target_amount preenchido, agrupadas sob a categoria "Metas".
    """

    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db
        self.model = SubcategoryORM

    async def _get_or_create_metas_categoria(self, entity_type: str = "individual", user_id: int = 1) -> CategoryORM:
        """Retorna a categoria 'Metas' para o entity_type informado, criando se não existir."""
        result = await self.db.execute(
            select(CategoryORM)
            .where(
                CategoryORM.name == METAS_CATEGORIA_NOME,
                CategoryORM.entity_type == entity_type,
                CategoryORM.user_id == user_id,
            )
        )
        categoria = result.scalars().first()
        if not categoria:
            categoria = CategoryORM(
                name=METAS_CATEGORIA_NOME,
                entity_type=entity_type,
                type=None,
                limit=0,
                user_id=user_id,
            )
            self.db.add(categoria)
            await self.db.commit()
            await self.db.refresh(categoria)
        return categoria

    async def list_metas(self, completed: Optional[bool] = None, entity_type: Optional[str] = None, limit: int = 100, offset: int = 0, user_id: int = 1) -> List[SubcategoryORM]:
        """Lista todas as subcategorias que são metas (possuem target_amount).
        
        Args:
            completed: Se True, retorna apenas concluídas. Se False, apenas ativas. Se None, todas.
            entity_type: Filtrar por tipo de entidade (individual, business). Se None, todas.
            limit: Limite de itens por página
            offset: Offset para paginação
        """
        log = log_database_operation(operation="read_all", collection="metas", limit=limit, offset=offset, user_id=user_id)
        query = (
            select(self.model)
            .join(CategoryORM, self.model.category)
            .where(
                self.model.target_amount.isnot(None),
                CategoryORM.user_id == user_id,
            )
        )
        if completed is not None:
            query = query.where(self.model.completed == completed)
        if entity_type:
            query = query.where(CategoryORM.entity_type == entity_type)
        query = query.order_by(self.model.name).limit(limit).offset(offset)

        result = await self.db.execute(query)
        metas = result.unique().scalars().all()
        log.info(f"{len(metas)} metas encontradas")
        return metas

    async def create_meta(self, obj_in: MetaCreate, user_id: int = 1) -> SubcategoryORM:
        """Cria uma nova meta (subcategoria com target_amount na categoria Metas)."""
        log = log_database_operation(operation="create", collection="metas", payload=obj_in.model_dump(), user_id=user_id)
        categoria = await self._get_or_create_metas_categoria(entity_type=obj_in.entity_type, user_id=user_id)

        # Verifica se já existe subcategoria com mesmo nome
        existente = await self.db.execute(
            select(self.model).where(
                self.model.name == obj_in.subcategory_name,
                self.model.category_id == categoria.id
            )
        )
        if existente.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Meta com nome '{obj_in.subcategory_name}' já existe"
            )

        meta = self.model(
            name=obj_in.subcategory_name,
            category_id=categoria.id,
            target_amount=obj_in.target_amount,
        )
        self.db.add(meta)
        await self.db.commit()
        await self.db.refresh(meta)
        log.info(f"Meta {meta.id} criada: {meta.name}")
        return meta

    async def update_meta(self, meta_id: int, obj_in: MetaUpdate, user_id: int = 1) -> Optional[SubcategoryORM]:
        """Atualiza uma meta existente."""
        log = log_database_operation(operation="update", collection="metas", meta_id=meta_id, user_id=user_id)
        meta = await self._get_user_meta(meta_id, user_id)
        if not meta or meta.target_amount is None:
            log.warning(f"Meta {meta_id} não encontrada")
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        field_map = {
            'subcategory_name': 'name',
            'target_amount': 'target_amount',
        }
        for field, value in update_data.items():
            orm_field = field_map.get(field, field)
            setattr(meta, orm_field, value)
        await self.db.commit()
        await self.db.refresh(meta)
        log.info(f"Meta {meta_id} atualizada")
        return meta

    async def delete_meta(self, meta_id: int, user_id: int = 1) -> Optional[SubcategoryORM]:
        """Remove uma meta (deleta a subcategoria)."""
        log = log_database_operation(operation="delete", collection="metas", meta_id=meta_id, user_id=user_id)
        meta = await self._get_user_meta(meta_id, user_id)
        if not meta or meta.target_amount is None:
            log.warning(f"Meta {meta_id} não encontrada")
            return None

        await self.db.delete(meta)
        await self.db.commit()
        log.info(f"Meta {meta_id} excluída")
        return meta

    async def complete_goal(self, meta_id: int, user_id: int = 1) -> Optional[SubcategoryORM]:
        """Marca uma meta como concluída com a data atual."""
        log = log_database_operation(operation="complete", collection="metas", meta_id=meta_id, user_id=user_id)
        meta = await self._get_user_meta(meta_id, user_id)
        if not meta or meta.target_amount is None:
            log.warning(f"Meta {meta_id} não encontrada")
            return None
        meta.completed = True
        meta.completed_at = date.today()
        await self.db.commit()
        await self.db.refresh(meta)
        log.info(f"Meta {meta_id} concluída em {meta.completed_at}")
        return meta

    async def reactivate_goal(self, meta_id: int, user_id: int = 1) -> Optional[SubcategoryORM]:
        """Reativa uma meta concluída."""
        log = log_database_operation(operation="reactivate", collection="metas", meta_id=meta_id, user_id=user_id)
        meta = await self._get_user_meta(meta_id, user_id)
        if not meta or meta.target_amount is None:
            log.warning(f"Meta {meta_id} não encontrada")
            return None
        meta.completed = False
        meta.completed_at = None
        await self.db.commit()
        await self.db.refresh(meta)
        log.info(f"Meta {meta_id} reativada")
        return meta

    async def _get_user_meta(self, meta_id: int, user_id: int) -> Optional[SubcategoryORM]:
        """Busca uma meta (subcategoria) garantindo que pertença a uma categoria do usuário."""
        result = await self.db.execute(
            select(self.model)
            .join(CategoryORM, self.model.category)
            .where(self.model.id == meta_id, CategoryORM.user_id == user_id)
        )
        return result.scalars().first()

    async def calcular_progresso_todas(self, ano: int, mes: int, completed: Optional[bool] = None, entity_type: Optional[str] = None, user_id: int = 1) -> List[dict]:
        """Calcula o progresso de todas as metas no mês informado usando GROUP BY (1 query).
        
        Args:
            ano: Ano para calcular progresso
            mes: Mês para calcular progresso
            completed: Se True, apenas concluídas. Se False, apenas ativas. Se None, todas.
            entity_type: Filtrar por tipo de entidade (individual, business). Se None, todas.
            user_id: Id do usuário autenticado
        """
        # Busca metas (1 query)
        metas = await self.list_metas(completed=completed, entity_type=entity_type, user_id=user_id)
        if not metas:
            return []

        meta_ids = [m.id for m in metas]
        meta_map = {m.id: m for m in metas}

        # Range conditions para usar índice em transaction_date
        from datetime import datetime
        mes_inicio = datetime(ano, mes, 1)
        if mes == 12:
            mes_fim = datetime(ano + 1, 1, 1)
        else:
            mes_fim = datetime(ano, mes + 1, 1)

        # Soma agrupada por subcategoria (1 query, não N+1)
        result = await self.db.execute(
            select(
                TransactionORM.subcategory_id,
                func.coalesce(func.sum(TransactionORM.amount), 0).label("total"),
            )
            .where(
                TransactionORM.subcategory_id.in_(meta_ids),
                TransactionORM.transaction_date >= mes_inicio,
                TransactionORM.transaction_date < mes_fim,
            )
            .group_by(TransactionORM.subcategory_id)
        )
        totals = {row.subcategory_id: float(row.total) for row in result}

        resultados = []
        for meta_id, meta in meta_map.items():
            current_amount = totals.get(meta_id, 0.0)
            progresso = (current_amount / meta.target_amount * 100) if meta.target_amount > 0 else 0.0
            resultados.append({
                "subcategory_id": meta.id,
                "subcategory_name": meta.name,
                "target_amount": meta.target_amount,
                "current_amount": round(current_amount, 2),
                "progress": round(progresso, 1),
                "completed": meta.completed,
                "completed_at": meta.completed_at,
                "entity_type": meta.category.entity_type if meta.category else 'individual',
            })
        return resultados
