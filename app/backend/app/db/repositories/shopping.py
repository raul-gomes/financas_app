# app/db/repositories/shopping.py

from typing import List, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from datetime import date, timedelta
from uuid import uuid4
from dateutil.relativedelta import relativedelta

from app.core.database import get_session
from app.db.models.shopping_item import ShoppingItemORM
from app.schemas.shopping import ShoppingItemCreate, ShoppingItemUpdate, GenerateRecurringShoppingRequest
from app.logger import log_database_operation


class ShoppingRepository:
    """
    Repositório para operações CRUD de itens da lista de compras.
    """

    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db
        self.model = ShoppingItemORM

    async def list_by_month(self, reference_month: date, entity_type: Optional[str] = None,
                            user_id: Optional[int] = None) -> List[ShoppingItemORM]:
        """Lista itens de um mês específico, ordenados: não-marcados primeiro (mais recentes primeiro),
        depois marcados (mais recentes primeiro)."""
        log = log_database_operation(operation="read_all", collection="shopping_items", mes_ref=str(reference_month))
        # Ordena: não-marcados (checked=false) primeiro, depois por created_at descendente
        order_expr = case((self.model.checked == False, 0), else_=1)
        query = (
            select(self.model)
            .where(self.model.reference_month == reference_month)
        )
        if user_id is not None:
            query = query.where(self.model.user_id == user_id)
        if entity_type:
            query = query.where(self.model.entity_type == entity_type)
        query = query.order_by(order_expr, self.model.created_at.desc())

        result = await self.db.execute(query)
        items = result.scalars().all()
        log.info(f"{len(items)} itens encontrados para {reference_month}")
        return items

    async def create(self, obj_in: ShoppingItemCreate, user_id: Optional[int] = None) -> ShoppingItemORM:
        """Cria um novo item na lista de compras."""
        log = log_database_operation(operation="create", collection="shopping_items", payload=obj_in.model_dump())
        item = self.model(
            user_id=user_id,
            name=obj_in.name,
            reference_month=obj_in.reference_month,
            entity_type=obj_in.entity_type,
        )
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        log.info(f"Item {item.id} criado: {item.name}")
        return item

    async def update(self, item_id: int, obj_in: ShoppingItemUpdate,
                     user_id: Optional[int] = None) -> Optional[ShoppingItemORM]:
        """Atualiza um item (nome e/ou checked). 
        Quando checked=true, define completed_at automaticamente.
        Quando checked=false, limpa completed_at."""
        log = log_database_operation(operation="update", collection="shopping_items", item_id=item_id)
        item = await self._get_scoped(item_id, user_id)
        if not item:
            log.warning(f"Item {item_id} não encontrado")
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        field_map = {
            'name': 'name',
            'checked': 'checked',
            'entity_type': 'entity_type',
        }
        for field, value in update_data.items():
            orm_field = field_map.get(field, field)
            setattr(item, orm_field, value)
        # Auto-set completed_at when marking/unmarking (after setattr to avoid overwrite)
        if 'checked' in update_data:
            item.completed_at = date.today() if update_data['checked'] else None
        await self.db.commit()
        await self.db.refresh(item)
        log.info(f"Item {item_id} atualizado (checked={item.checked}, completed_at={item.completed_at})")
        return item

    async def delete(self, item_id: int, user_id: Optional[int] = None) -> Optional[ShoppingItemORM]:
        """Remove um item da lista."""
        log = log_database_operation(operation="delete", collection="shopping_items", item_id=item_id)
        item = await self._get_scoped(item_id, user_id)
        if not item:
            log.warning(f"Item {item_id} não encontrado")
            return None

        await self.db.delete(item)
        await self.db.commit()
        log.info(f"Item {item_id} excluído")
        return item

    async def _get_scoped(self, item_id: int, user_id: Optional[int]) -> Optional[ShoppingItemORM]:
        stmt = select(self.model).where(self.model.id == item_id)
        if user_id is not None:
            stmt = stmt.where(self.model.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def migrate_unchecked(self, source_month: date, target_month: date,
                                user_id: Optional[int] = None) -> int:
        """
        Copia itens não-marcados do mês de origem para o mês de destino.
        Retorna a quantidade de itens migrados.
        """
        if target_month <= source_month:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mês destino deve ser posterior ao mês de origem.",
            )
        log = log_database_operation(
            operation="migrate",
            collection="shopping_items",
            source_month=str(source_month),
            target_month=str(target_month),
        )
        # Busca itens não-marcados do mês de origem
        stmt = select(self.model).where(
            self.model.reference_month == source_month,
            self.model.checked == False,
        )
        if user_id is not None:
            stmt = stmt.where(self.model.user_id == user_id)
        result = await self.db.execute(stmt)
        items = result.scalars().all()
        if not items:
            log.info("Nenhum item para migrar")
            return 0

        # Cria cópias no mês destino
        novos = []
        for item in items:
            novo = self.model(
                user_id=user_id,
                name=item.name,
                reference_month=target_month,
                entity_type=item.entity_type,
            )
            novos.append(novo)
        self.db.add_all(novos)
        await self.db.commit()
        log.info(f"{len(novos)} itens migrados de {source_month} para {target_month}")
        return len(novos)

    async def generate_recurring_items(self, req: GenerateRecurringShoppingRequest,
                                       user_id: Optional[int] = None) -> int:
        """
        Gera itens de compras recorrentes para os meses no intervalo.
        Busca itens marcados como recorrentes (is_recurring=true) e cria cópias
        para cada mês subsequente até recurrence_end_date ou end_month.
        """
        log = log_database_operation(
            operation="generate_recurring",
            collection="shopping_items",
            start_month=str(req.start_month),
            end_month=str(req.end_month),
        )

        # Busca itens recorrentes ativos no mês inicial
        stmt = select(self.model).where(
            self.model.reference_month == req.start_month,
            self.model.is_recurring == True,
            self.model.checked == False,  # só itens não comprados
        )
        if user_id is not None:
            stmt = stmt.where(self.model.user_id == user_id)
        if req.entity_type:
            stmt = stmt.where(self.model.entity_type == req.entity_type)

        result = await self.db.execute(stmt)
        recurring_items = result.scalars().all()

        if not recurring_items:
            log.info("Nenhum item recorrente encontrado")
            return 0

        gerados = 0
        current_month = req.start_month + relativedelta(months=1)

        while current_month <= req.end_month:
            for item in recurring_items:
                # Verifica se já passou da data fim da recorrência
                if item.recurrence_end_date and current_month > item.recurrence_end_date:
                    continue

                # Verifica se já existe este item neste mês (pelo grupo de recorrência)
                if item.recurrence_group_id:
                    existing_stmt = select(self.model).where(
                        self.model.recurrence_group_id == item.recurrence_group_id,
                        self.model.reference_month == current_month,
                    )
                    if user_id is not None:
                        existing_stmt = existing_stmt.where(self.model.user_id == user_id)
                    existing = await self.db.execute(existing_stmt)
                    if existing.scalars().first():
                        continue  # já existe

                # Cria o item para este mês
                novo = self.model(
                    user_id=user_id,
                    name=item.name,
                    reference_month=current_month,
                    entity_type=item.entity_type,
                    is_recurring=True,
                    recurrence_group_id=item.recurrence_group_id or str(uuid4()),
                    recurrence_end_date=item.recurrence_end_date,
                )
                self.db.add(novo)
                gerados += 1

            current_month = current_month + relativedelta(months=1)

        if gerados > 0:
            await self.db.commit()
            log.info(f"{gerados} itens recorrentes gerados")
        return gerados
