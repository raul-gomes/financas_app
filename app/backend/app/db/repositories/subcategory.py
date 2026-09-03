# app/db/repositories/subcategoria.py

from typing import List, Optional
from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from sqlalchemy.exc import IntegrityError

from app.core.database import get_session
from app.db.models.category import SubcategoryORM, CategoryORM
from app.logger import log_database_operation
from app.schemas.categories import Subcategoria, SubcategoriaUpdate
from app.schemas.subcategory import SubcategoriaCreate


class SubcategoriaRepository:
    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db
        self.model = SubcategoryORM

    async def get_by_id(self, id: int, user_id: int) -> Optional[SubcategoryORM]:
        """Busca uma subcategoria por ID, garantindo que pertença a uma categoria do usuário."""
        result = await self.db.execute(
            select(self.model).where(
                self.model.id == id,
                self.model.category.has(CategoryORM.user_id == user_id),
            )
        )
        return result.scalars().first()

    async def get_by_nome_and_categoria(self, nome: str, categoria_id: int, user_id: int) -> Optional[SubcategoryORM]:
        """Busca subcategoria por nome sob uma categoria que pertença ao usuário."""
        result = await self.db.execute(
            select(self.model).where(
                self.model.name == nome,
                self.model.category_id == categoria_id,
                self.model.category.has(CategoryORM.user_id == user_id),
            )
        )
        return result.scalars().first()
    
    async def create(self, categoria_id: int, user_id: int, obj_in: SubcategoriaCreate) -> SubcategoryORM:
        log = log_database_operation(operation="create", collection="subcategorias", payload=obj_in.dict(), user_id=user_id)
        try:
            # Garante que a categoria pertence ao usuário
            categoria = await self.db.get(CategoryORM, categoria_id)
            if not categoria or categoria.user_id != user_id:
                raise HTTPException(status_code=404, detail="Categoria não encontrada")
            inst = self.model(name=obj_in.subcategory_name, category_id=categoria_id)
            self.db.add(inst)
            await self.db.commit()
            await self.db.refresh(inst)
            log.info(f"Subcategoria {inst.id} criada para categoria {categoria_id}")
            return inst
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Erro ao criar subcategoria")

    async def create_many(self, categoria_id: int, user_id: int, subs: List[SubcategoriaCreate]):
        sub_objs = [
            self.model(name=s.subcategory_name, category_id=categoria_id)
            for s in subs
        ]
        self.db.add_all(sub_objs)
        await self.db.commit()

    async def get_by_categoria(self, categoria_id: int, user_id: int) -> List[SubcategoryORM]:
        """Busca todas as subcategorias de uma categoria do usuário"""
        result = await self.db.execute(
            select(self.model).where(
                self.model.category_id == categoria_id,
                self.model.category.has(CategoryORM.user_id == user_id),
            )
        )
        return result.scalars().all()

    async def update(self, id: int, user_id: int, obj_in: SubcategoriaUpdate) -> Optional[SubcategoryORM]:
        """Atualiza uma subcategoria, garantindo que pertença a uma categoria do usuário."""
        sub = await self.get_by_id(id, user_id)
        if not sub:
            return None
        
        update_data = obj_in.model_dump(exclude_unset=True, exclude={"id"})
        field_map = {
            'subcategory_name': 'name',
        }
        for field, value in update_data.items():
            orm_field = field_map.get(field, field)
            setattr(sub, orm_field, value)
        
        await self.db.commit()
        await self.db.refresh(sub)
        return sub

    async def delete(self, id: int, user_id: int) -> Optional[SubcategoryORM]:
        """Deleta uma subcategoria, garantindo que pertença a uma categoria do usuário."""
        sub = await self.get_by_id(id, user_id)
        if not sub:
            return None
        
        await self.db.delete(sub)
        await self.db.commit()
        return sub

    async def delete_by_categoria(self, categoria_id: int, user_id: int) -> None:
        """Deleta todas as subcategorias de uma categoria do usuário"""
        await self.db.execute(
            delete(self.model)
            .where(
                self.model.category_id == categoria_id,
                self.model.category.has(CategoryORM.user_id == user_id),
            )
        )
        await self.db.commit()
