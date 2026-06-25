# app/db/repositories/shopping.py

from typing import List, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, case
from datetime import date, timedelta

from app.core.database import get_session
from app.db.models.shopping_item import ShoppingItemORM
from app.schemas.shopping import ShoppingItemCreate, ShoppingItemUpdate
from app.logger import log_database_operation


class ShoppingRepository:
    """
    Repositório para operações CRUD de itens da lista de compras.
    """

    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db
        self.model = ShoppingItemORM

    async def list_by_month(self, mes_ref: date) -> List[ShoppingItemORM]:
        """Lista itens de um mês específico, ordenados: não-marcados primeiro (mais recentes primeiro),
        depois marcados (mais recentes primeiro)."""
        log = log_database_operation(operation="read_all", collection="shopping_items", mes_ref=str(mes_ref))
        # Ordena: não-marcados (marcado=false) primeiro, depois por created_at descendente
        order_expr = case((self.model.marcado == False, 0), else_=1)
        result = await self.db.execute(
            select(self.model)
            .where(self.model.mes_ref == mes_ref)
            .order_by(order_expr, self.model.created_at.desc())
        )
        items = result.scalars().all()
        log.info(f"{len(items)} itens encontrados para {mes_ref}")
        return items

    async def create(self, obj_in: ShoppingItemCreate) -> ShoppingItemORM:
        """Cria um novo item na lista de compras."""
        log = log_database_operation(operation="create", collection="shopping_items", payload=obj_in.model_dump())
        item = self.model(
            nome=obj_in.nome,
            mes_ref=obj_in.mes_ref,
        )
        self.db.add(item)
        await self.db.commit()
        await self.db.refresh(item)
        log.info(f"Item {item.id} criado: {item.nome}")
        return item

    async def update(self, item_id: int, obj_in: ShoppingItemUpdate) -> Optional[ShoppingItemORM]:
        """Atualiza um item (nome e/ou marcado). 
        Quando marcado=true, define data_conclusao automaticamente.
        Quando marcado=false, limpa data_conclusao."""
        log = log_database_operation(operation="update", collection="shopping_items", item_id=item_id)
        item = await self.db.get(self.model, item_id)
        if not item:
            log.warning(f"Item {item_id} não encontrado")
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        # Auto-set data_conclusao when marking/unmarking
        if 'marcado' in update_data:
            item.data_conclusao = date.today() if update_data['marcado'] else None
        for field, value in update_data.items():
            setattr(item, field, value)
        await self.db.commit()
        await self.db.refresh(item)
        log.info(f"Item {item_id} atualizado (marcado={item.marcado}, data_conclusao={item.data_conclusao})")
        return item

    async def delete(self, item_id: int) -> Optional[ShoppingItemORM]:
        """Remove um item da lista."""
        log = log_database_operation(operation="delete", collection="shopping_items", item_id=item_id)
        item = await self.db.get(self.model, item_id)
        if not item:
            log.warning(f"Item {item_id} não encontrado")
            return None

        await self.db.delete(item)
        await self.db.commit()
        log.info(f"Item {item_id} excluído")
        return item

    async def migrar_nao_marcados(self, mes_origem: date, mes_destino: date) -> int:
        """
        Copia itens não-marcados do mês de origem para o mês de destino.
        Retorna a quantidade de itens migrados.
        """
        log = log_database_operation(
            operation="migrate",
            collection="shopping_items",
            mes_origem=str(mes_origem),
            mes_destino=str(mes_destino),
        )
        # Busca itens não-marcados do mês de origem
        result = await self.db.execute(
            select(self.model).where(
                self.model.mes_ref == mes_origem,
                self.model.marcado == False,
            )
        )
        items = result.scalars().all()
        if not items:
            log.info("Nenhum item para migrar")
            return 0

        # Cria cópias no mês destino
        novos = []
        for item in items:
            novo = self.model(
                nome=item.nome,
                mes_ref=mes_destino,
            )
            novos.append(novo)
        self.db.add_all(novos)
        await self.db.commit()
        log.info(f"{len(novos)} itens migrados de {mes_origem} para {mes_destino}")
        return len(novos)
