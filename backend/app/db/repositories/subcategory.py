# app/db/repositories/subcategoria.py

from typing import List, Optional
from fastapi import Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert, select, delete
from sqlalchemy.exc import IntegrityError

from app.core.database import get_session
from app.db.models.category import SubcategoryORM
from app.logger import log_database_operation
from app.schemas.categories import Subcategoria, SubcategoriaUpdate
from app.schemas.subcategory import SubcategoriaCreate


class SubcategoriaRepository:
    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db
        self.model = SubcategoryORM

    async def get_by_id(self, id: int) -> Optional[SubcategoryORM]:
        return await self.db.get(self.model, id)

    async def get_by_nome_and_categoria(self, nome: str, categoria_id: int) -> Optional[SubcategoryORM]:
        result = await self.db.execute(
            select(self.model).where(
                self.model.name == nome,
                self.model.category_id == categoria_id
            )
        )
        return result.scalars().first()
    
    async def create(self, categoria_id: int, obj_in: SubcategoriaCreate) -> SubcategoryORM:
        log = log_database_operation(operation="create", collection="subcategorias", payload=obj_in.dict())
        try:
            inst = self.model(name=obj_in.subcategory_name, category_id=categoria_id)
            self.db.add(inst)
            await self.db.commit()
            await self.db.refresh(inst)
            log.info(f"Subcategoria {inst.id} criada para categoria {categoria_id}")
            return inst
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Erro ao criar subcategoria")

    async def create_many(self, categoria_id: int, subs: List[SubcategoriaCreate]):
        sub_objs = [
            self.model(name=s.subcategory_name, category_id=categoria_id)
            for s in subs
        ]
        self.db.add_all(sub_objs)
        await self.db.commit()

    async def get_by_categoria(self, categoria_id: int) -> List[SubcategoryORM]:
        """Busca todas as subcategorias de uma categoria"""
        result = await self.db.execute(
            select(self.model).where(self.model.category_id == categoria_id)
        )
        return result.scalars().all()

    async def update(self, id: int, obj_in: SubcategoriaUpdate) -> Optional[SubcategoryORM]:
        """Atualiza uma subcategoria"""
        sub = await self.db.get(self.model, id)
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

    async def delete(self, id: int) -> Optional[SubcategoryORM]:
        """Deleta uma subcategoria"""
        sub = await self.db.get(self.model, id)
        if not sub:
            return None
        
        await self.db.delete(sub)
        await self.db.commit()
        return sub

    async def delete_by_categoria(self, categoria_id: int) -> None:
        """Deleta todas as subcategorias de uma categoria"""
        await self.db.execute(
            delete(self.model).where(self.model.category_id == categoria_id)
        )
        await self.db.commit()
