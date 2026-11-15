# app/db/repositories/shopping.py

from datetime import date
from uuid import uuid4

from dateutil.relativedelta import relativedelta
from fastapi import Depends
from sqlalchemy import and_, case, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.db.models.shopping_item import ShoppingItemORM
from app.logger import log_database_operation
from app.schemas.shopping import (
    GenerateRecurringShoppingRequest,
    ShoppingItemCreate,
    ShoppingItemUpdate,
)


class ShoppingRepository:
    """
    Repositório para operações CRUD de itens da lista de compras.
    Só faz flush: o commit é da unit of work do request (ver ``ShoppingService``).
    """

    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db
        self.model = ShoppingItemORM

    async def list_by_month(
        self,
        reference_month: date,
        entity_type: str | None = None,
        *,
        user_id: int,
    ) -> list[ShoppingItemORM]:
        """Lista itens de um mês específico com ROLLOVER: inclui itens não-marcados
        de meses anteriores (que não foram comprados). Ordenados: não-marcados
        primeiro (mais recentes primeiro), depois marcados (mais recentes primeiro)."""
        log = log_database_operation(
            operation="read_all", collection="shopping_items", mes_ref=str(reference_month)
        )
        # Ordena: não-marcados (checked=false) primeiro, depois por created_at descendente
        order_expr = case((self.model.checked == False, 0), else_=1)  # noqa: E712  # SQLAlchemy column comparison
        # Rollover: itens do próprio mês + não-marcados (não comprados) de meses anteriores
        query = select(self.model).where(
            or_(
                self.model.reference_month == reference_month,
                and_(
                    self.model.reference_month < reference_month,
                    self.model.checked == False,  # noqa: E712  # SQLAlchemy column comparison
                ),
            )
        )
        query = query.where(self.model.user_id == user_id)
        if entity_type:
            query = query.where(self.model.entity_type == entity_type)
        query = query.order_by(order_expr, self.model.created_at.desc())

        result = await self.db.execute(query)
        items = result.scalars().all()
        log.info(f"{len(items)} itens encontrados para {reference_month}")
        return items

    async def create(self, obj_in: ShoppingItemCreate, user_id: int) -> ShoppingItemORM:
        """Cria um novo item na lista de compras."""
        log = log_database_operation(
            operation="create", collection="shopping_items", payload=obj_in.model_dump()
        )
        item = self.model(
            user_id=user_id,
            name=obj_in.name,
            reference_month=obj_in.reference_month,
            entity_type=obj_in.entity_type,
        )
        self.db.add(item)
        await self.db.flush()
        await self.db.refresh(item)
        log.info(f"Item {item.id} criado: {item.name}")
        return item

    async def update(
        self, item_id: int, obj_in: ShoppingItemUpdate, user_id: int
    ) -> ShoppingItemORM | None:
        """Atualiza um item (nome e/ou checked).
        Quando checked=true, define completed_at automaticamente.
        Quando checked=false, limpa completed_at."""
        log = log_database_operation(
            operation="update", collection="shopping_items", item_id=item_id
        )
        item = await self._get_scoped(item_id, user_id)
        if not item:
            log.warning(f"Item {item_id} não encontrado")
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        field_map = {
            "name": "name",
            "checked": "checked",
            "entity_type": "entity_type",
        }
        for field, value in update_data.items():
            orm_field = field_map.get(field, field)
            setattr(item, orm_field, value)
        # Auto-set completed_at when marking/unmarking (after setattr to avoid overwrite)
        if "checked" in update_data:
            item.completed_at = date.today() if update_data["checked"] else None
        await self.db.flush()
        await self.db.refresh(item)
        log.info(
            f"Item {item_id} atualizado (checked={item.checked}, completed_at={item.completed_at})"
        )
        return item

    async def delete(self, item_id: int, user_id: int) -> ShoppingItemORM | None:
        """Remove um item da lista."""
        log = log_database_operation(
            operation="delete", collection="shopping_items", item_id=item_id
        )
        item = await self._get_scoped(item_id, user_id)
        if not item:
            log.warning(f"Item {item_id} não encontrado")
            return None

        await self.db.delete(item)
        await self.db.flush()
        log.info(f"Item {item_id} excluído")
        return item

    async def _get_scoped(self, item_id: int, user_id: int) -> ShoppingItemORM | None:
        stmt = select(self.model).where(self.model.id == item_id)
        stmt = stmt.where(self.model.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def generate_recurring_items(
        self, req: GenerateRecurringShoppingRequest, user_id: int
    ) -> int:
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
            self.model.is_recurring == True,  # noqa: E712  # SQLAlchemy column comparison
            self.model.checked == False,  # só itens não comprados  # noqa: E712
        )
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
            await self.db.flush()
            log.info(f"{gerados} itens recorrentes gerados")
        return gerados
