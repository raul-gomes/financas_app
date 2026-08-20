# app/db/repositories/categoria.py

from typing import List, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update as sql_update
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.core.database import get_session
from app.db.models.category import CategoryORM
from app.db.repositories.subcategory import SubcategoriaRepository
from app.schemas.categories import CategoriaCreate, CategoriaUpdate
from app.logger import log_database_operation


class CategoriaRepository:
    """
    Repositório para operações CRUD de Categoria e sincronização de Subcategoria.
    """

    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db
        self.model = CategoryORM
        self.sub_repo = SubcategoriaRepository(db)

    async def get_by_id(self, id: int) -> Optional[CategoryORM]:
        """
        Busca uma categoria pelo ID.
        """
        log = log_database_operation(operation="read", collection="categorias", categoria_id=id)
        result = await self.db.execute(
            select(self.model).options(selectinload(self.model.subcategories)).where(self.model.id == id)
        )
        categoria = result.scalars().first()
        if categoria:
            log.info(f"Categoria {id} encontrada")
        else:
            log.warning(f"Categoria {id} não encontrada")
        return categoria

    async def get_by_nome(self, nome: str) -> Optional[CategoryORM]:
        result = await self.db.execute(
            select(self.model).options(selectinload(self.model.subcategories)).where(self.model.name == nome)
        )
        return result.scalars().first()

    async def get_by_nome_and_entity_type(self, nome: str, entity_type: str) -> Optional[CategoryORM]:
        result = await self.db.execute(
            select(self.model).options(selectinload(self.model.subcategories)).where(
                self.model.name == nome,
                self.model.entity_type == entity_type,
            )
        )
        return result.scalars().first()

    async def get_by_tipo(self, tipo: str) -> Optional[CategoryORM]:
        """Busca a primeira categoria com o tipo informado (ex: 'income', 'investment')."""
        result = await self.db.execute(
            select(self.model).options(selectinload(self.model.subcategories)).where(self.model.type == tipo)
        )
        return result.scalars().first()
    
    async def create(self, obj_in: CategoriaCreate) -> CategoryORM:
        """
        Insere uma nova categoria e suas subcategorias (se houver).
        Lança HTTPException em caso de erro de unicidade.
        """
        log = log_database_operation(operation="create", collection="categorias", payload=obj_in.model_dump())
        try:
            # Map schema field names to ORM field names
            data = obj_in.model_dump(exclude={"subcategories"})
            field_map = {
                'category_name': 'name',
                'entity_type': 'entity_type',
                'limit': 'limit',
                'type': 'type',
            }
            orm_data = {}
            for schema_field, value in data.items():
                orm_field = field_map.get(schema_field, schema_field)
                orm_data[orm_field] = value

            instance = self.model(**orm_data)
            self.db.add(instance)
            await self.db.commit()
            await self.db.refresh(instance)

            if obj_in.subcategories:
                await self.sub_repo.create_many(instance.id, obj_in.subcategories)

            log.info(f"Categoria {instance.id} criada")
            
            # Recarrega categoria completa com subcategorias
            result = await self.db.execute(
                select(self.model).options(selectinload(self.model.subcategories)).where(self.model.id == instance.id)
            )
            return result.scalars().first()
            
        except IntegrityError as e:
            await self.db.rollback()
            if "categorias.name" in str(e):
                log.error("Violação de unicidade em name")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Categoria com nome '{obj_in.category_name}' já existe"
                )
            log.error(f"Erro de integridade no banco: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erro de integridade no banco de dados"
            )

    async def get_all(self) -> List[CategoryORM]:
        """
        Recupera todas as categorias, incluindo subcategorias.
        """
        log = log_database_operation(operation="read_all", collection="categorias")
        stmt = select(self.model).options(selectinload(self.model.subcategories)).order_by(self.model.name)
        result = await self.db.execute(stmt)
        categorias = result.unique().scalars().all()
        log.info(f"{len(categorias)} categorias recuperadas")
        return categorias

    async def update(self, id: int, obj_in: CategoriaUpdate) -> Optional[CategoryORM]:
        categoria = await self.get_by_id(id)
        if not categoria:
            return None

        # 1) Unicidade de nome
        if obj_in.category_name:
            conflict = (await self.db.execute(
                select(self.model)
                .where(self.model.name == obj_in.category_name, self.model.id != id)
            )).scalars().first()
            if conflict:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Outra categoria com nome '{obj_in.category_name}' já existe"
                )

        # 2) Atualiza campos básicos
        base = obj_in.model_dump(exclude_unset=True, exclude={"subcategories"})
        field_map = {
            'category_name': 'name',
            'entity_type': 'entity_type',
            'limit': 'limit',
            'type': 'type',
        }
        for field, val in base.items():
            orm_field = field_map.get(field, field)
            setattr(categoria, orm_field, val)
        await self.db.commit()

        # 3) Sincroniza subcategorias sem deletar as existentes
        incoming = obj_in.subcategories or []

        # Mapear IDs existentes para atualização
        for sub in incoming:
            if sub.id is not None:
                await self.sub_repo.update(sub.id, sub)

        # Criar apenas as novas (sem id)
        new_subs = [s for s in incoming if s.id is None]
        if new_subs:
            await self.sub_repo.create_many(categoria.id, new_subs)

        # 4) Recarrega e retorna
        result = await self.db.execute(
            select(self.model).options(selectinload(self.model.subcategories)).where(self.model.id == id)
        )
        return result.scalars().first()

    async def delete(self, id: int) -> Optional[CategoryORM]:
        """
        Remove uma categoria pelo ID.
        """
        log = log_database_operation(operation="delete", collection="categorias", categoria_id=id)
        categoria = await self.get_by_id(id)
        if not categoria:
            return None
        await self.db.delete(categoria)
        await self.db.commit()
        log.info(f"Categoria {id} excluída")
        return categoria
