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
from app.db.repositories.dashboard import _invalidate_opcoes_categorias_cache


class CategoriaRepository:
    """
    Repositório para operações CRUD de Categoria e sincronização de Subcategoria.
    """

    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db
        self.model = CategoryORM
        self.sub_repo = SubcategoriaRepository(db)

    async def get_by_id(self, id: int, user_id: int) -> Optional[CategoryORM]:
        """
        Busca uma categoria pelo ID, restrita ao usuário.
        """
        log = log_database_operation(operation="read", collection="categorias", categoria_id=id, user_id=user_id)
        result = await self.db.execute(
            select(self.model).where(self.model.id == id, self.model.user_id == user_id)
        )
        categoria = result.scalars().first()
        if categoria:
            log.info(f"Categoria {id} encontrada")
        else:
            log.warning(f"Categoria {id} não encontrada")
        return categoria

    async def get_by_nome(self, nome: str, user_id: int) -> Optional[CategoryORM]:
        result = await self.db.execute(
            select(self.model).where(self.model.name == nome, self.model.user_id == user_id)
        )
        return result.scalars().first()

    async def get_by_nome_and_entity_type(self, nome: str, entity_type: str, user_id: int) -> Optional[CategoryORM]:
        result = await self.db.execute(
            select(self.model).where(
                self.model.name == nome,
                self.model.entity_type == entity_type,
                self.model.user_id == user_id,
            )
        )
        return result.scalars().first()

    async def get_by_tipo(self, tipo: str, user_id: int) -> Optional[CategoryORM]:
        """Busca a primeira categoria com o tipo informado (ex: 'income', 'investment')."""
        result = await self.db.execute(
            select(self.model).where(self.model.type == tipo, self.model.user_id == user_id)
        )
        return result.scalars().first()
    
    async def create(self, user_id: int, obj_in: CategoriaCreate) -> CategoryORM:
        """
        Insere uma nova categoria e suas subcategorias (se houver).
        Lança HTTPException em caso de erro de unicidade.
        """
        log = log_database_operation(operation="create", collection="categorias", payload=obj_in.model_dump(), user_id=user_id)
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

            instance = self.model(user_id=user_id, **orm_data)
            self.db.add(instance)
            await self.db.commit()
            await self.db.refresh(instance)

            if obj_in.subcategories:
                await self.sub_repo.create_many(instance.id, user_id, obj_in.subcategories)

            log.info(f"Categoria {instance.id} criada")
            _invalidate_opcoes_categorias_cache()
            
            # Recarrega categoria completa com subcategorias
            result = await self.db.execute(
                select(self.model).options(selectinload(self.model.subcategories)).where(self.model.id == instance.id)
            )
            return result.scalars().first()
            
        except IntegrityError as e:
            await self.db.rollback()
            err = str(e)
            if "categorias.name" in err or "uq_categorias_name_entity_type" in err or "uq_categorias_name_entity_type_user" in err:
                log.error("Violação de unicidade em (name, entity_type, user_id)")
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Categoria com nome '{obj_in.category_name}' já existe"
                )
            log.error(f"Erro de integridade no banco: {e}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Erro de integridade no banco de dados"
            )

    async def get_all(self, user_id: int) -> List[CategoryORM]:
        """
        Recupera todas as categorias do usuário, incluindo subcategorias.
        """
        log = log_database_operation(operation="read_all", collection="categorias", user_id=user_id)
        stmt = select(self.model).where(self.model.user_id == user_id).order_by(self.model.name)
        result = await self.db.execute(stmt)
        categorias = result.unique().scalars().all()
        log.info(f"{len(categorias)} categorias recuperadas")
        return categorias

    async def update(self, id: int, user_id: int, obj_in: CategoriaUpdate) -> Optional[CategoryORM]:
        categoria = await self.get_by_id(id, user_id)
        if not categoria:
            return None

        # 1) Unicidade de nome
        if obj_in.category_name:
            conflict = (await self.db.execute(
                select(self.model)
                .where(self.model.name == obj_in.category_name, self.model.id != id, self.model.user_id == user_id)
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
                await self.sub_repo.update(sub.id, user_id, sub)

        # Criar apenas as novas (sem id)
        new_subs = [s for s in incoming if s.id is None]
        if new_subs:
            await self.sub_repo.create_many(categoria.id, user_id, new_subs)

        # 4) Recarrega e retorna
        result = await self.db.execute(
            select(self.model).where(self.model.id == id)
        )
        _invalidate_opcoes_categorias_cache()
        return result.scalars().first()

    async def delete(self, id: int, user_id: int) -> Optional[CategoryORM]:
        """
        Remove uma categoria pelo ID, restrita ao usuário.
        """
        log = log_database_operation(operation="delete", collection="categorias", categoria_id=id, user_id=user_id)
        categoria = await self.get_by_id(id, user_id)
        if not categoria:
            return None
        await self.db.delete(categoria)
        await self.db.commit()
        _invalidate_opcoes_categorias_cache()
        log.info(f"Categoria {id} excluída")
        return categoria
