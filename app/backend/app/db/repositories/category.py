# app/db/repositories/categoria.py


from fastapi import Depends
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.errors import ConflictError, ValidationError
from app.db.models.category import CategoryORM
from app.db.models.transaction import TransactionORM
from app.db.repositories.dashboard import invalidate_opcoes_categorias_cache
from app.db.repositories.subcategory import SubcategoriaRepository
from app.logger import log_database_operation
from app.schemas.categories import CategoriaCreate, CategoriaUpdate

HAS_TRANSACTIONS_MESSAGE = "Categoria possui transações vinculadas"
# Category valid for both natures (PF and PJ).
SHARED_ENTITY_TYPE = "all"


class CategoriaRepository:
    """
    Repositório para operações CRUD de Categoria e sincronização de Subcategoria.
    """

    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db
        self.model = CategoryORM
        self.sub_repo = SubcategoriaRepository(db)

    async def get_by_id(self, id: int, user_id: int) -> CategoryORM | None:
        """
        Busca uma categoria pelo ID, restrita ao usuário.
        """
        log = log_database_operation(
            operation="read", collection="categorias", categoria_id=id, user_id=user_id
        )
        result = await self.db.execute(
            select(self.model).where(self.model.id == id, self.model.user_id == user_id)
        )
        categoria = result.scalars().first()
        if categoria:
            log.info(f"Categoria {id} encontrada")
        else:
            log.warning(f"Categoria {id} não encontrada")
        return categoria

    async def _has_transactions(self, category_id: int, user_id: int) -> bool:
        """True when the user has at least one transaction in the category."""
        result = await self.db.execute(
            select(TransactionORM.id)
            .where(TransactionORM.category_id == category_id, TransactionORM.user_id == user_id)
            .limit(1)
        )
        return result.first() is not None

    async def get_by_nome_for_entity(
        self, nome: str, entity_type: str, user_id: int
    ) -> CategoryORM | None:
        """Category with this name for a transaction of ``entity_type`` (PF/PJ).

        Prefers the category of the same nature and falls back to one shared by both
        (``all``); never borrows the category of the other nature.
        """
        entity_type = getattr(entity_type, "value", entity_type)  # accepts the enum or its value
        same_nature = await self.get_by_nome_and_entity_type(nome, entity_type, user_id)
        if same_nature is not None:
            return same_nature
        return await self.get_by_nome_and_entity_type(nome, SHARED_ENTITY_TYPE, user_id)

    async def get_by_nome_and_entity_type(
        self, nome: str, entity_type: str, user_id: int
    ) -> CategoryORM | None:
        result = await self.db.execute(
            select(self.model).where(
                self.model.name == nome,
                self.model.entity_type == entity_type,
                self.model.user_id == user_id,
            )
        )
        return result.scalars().first()

    async def get_by_tipo(self, tipo: str, user_id: int) -> CategoryORM | None:
        """Busca a primeira categoria com o tipo informado (ex: 'income', 'investment')."""
        result = await self.db.execute(
            select(self.model).where(self.model.type == tipo, self.model.user_id == user_id)
        )
        return result.scalars().first()

    async def create(self, user_id: int, obj_in: CategoriaCreate) -> CategoryORM:
        """
        Insere uma nova categoria e suas subcategorias (se houver).
        Raises ConflictError on a duplicate name and ValidationError on other integrity errors.

        Só faz flush: o commit fica com a unit of work do request.
        """
        log = log_database_operation(
            operation="create",
            collection="categorias",
            payload=obj_in.model_dump(),
            user_id=user_id,
        )
        try:
            # Map schema field names to ORM field names
            data = obj_in.model_dump(exclude={"subcategories"})
            field_map = {
                "category_name": "name",
                "entity_type": "entity_type",
                "limit": "limit",
                "type": "type",
            }
            orm_data = {}
            for schema_field, value in data.items():
                orm_field = field_map.get(schema_field, schema_field)
                orm_data[orm_field] = value

            instance = self.model(user_id=user_id, **orm_data)
            self.db.add(instance)
            await self.db.flush()
            await self.db.refresh(instance)

            if obj_in.subcategories:
                await self.sub_repo.create_many(instance.id, user_id, obj_in.subcategories)

            log.info(f"Categoria {instance.id} criada")
            invalidate_opcoes_categorias_cache()

            # The collection loaded by the first refresh is stale once subcategories were
            # added: reload just that attribute so the returned category is complete.
            await self.db.refresh(instance, attribute_names=["subcategories"])
            return instance

        except IntegrityError as e:
            err = str(e)
            if (
                "categorias.name" in err
                or "uq_categorias_name_entity_type" in err
                or "uq_categorias_name_entity_type_user" in err
            ):
                log.error("Violação de unicidade em (name, entity_type, user_id)")
                raise ConflictError(f"Categoria com nome '{obj_in.category_name}' já existe") from e
            log.error(f"Erro de integridade no banco: {e}")
            raise ValidationError("Erro de integridade no banco de dados") from e

    async def get_all(self, user_id: int) -> list[CategoryORM]:
        """
        Recupera todas as categorias do usuário, incluindo subcategorias.
        """
        log = log_database_operation(operation="read_all", collection="categorias", user_id=user_id)
        stmt = select(self.model).where(self.model.user_id == user_id).order_by(self.model.name)
        result = await self.db.execute(stmt)
        categorias = result.unique().scalars().all()
        log.info(f"{len(categorias)} categorias recuperadas")
        return categorias

    async def update(self, id: int, user_id: int, obj_in: CategoriaUpdate) -> CategoryORM | None:
        """Updates a category and syncs its subcategories (flush only)."""
        categoria = await self.get_by_id(id, user_id)
        if not categoria:
            return None

        # 1) Unicidade de nome
        if obj_in.category_name:
            conflict = (
                (
                    await self.db.execute(
                        select(self.model).where(
                            self.model.name == obj_in.category_name,
                            # Names are unique per nature: PF and PJ may share one (same rule as create)
                            self.model.entity_type == (obj_in.entity_type or categoria.entity_type),
                            self.model.id != id,
                            self.model.user_id == user_id,
                        )
                    )
                )
                .scalars()
                .first()
            )
            if conflict:
                raise ConflictError(f"Outra categoria com nome '{obj_in.category_name}' já existe")

        # 2) Atualiza campos básicos
        base = obj_in.model_dump(exclude_unset=True, exclude={"subcategories"})
        field_map = {
            "category_name": "name",
            "entity_type": "entity_type",
            "limit": "limit",
            "type": "type",
        }
        for field, val in base.items():
            orm_field = field_map.get(field, field)
            setattr(categoria, orm_field, val)
        await self.db.flush()

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
        result = await self.db.execute(select(self.model).where(self.model.id == id))
        invalidate_opcoes_categorias_cache()
        return result.scalars().first()

    async def delete(self, id: int, user_id: int, *, commit: bool = True) -> CategoryORM | None:
        """
        Remove uma categoria pelo ID, restrita ao usuário (só flush com ``commit=False``).
        """
        log = log_database_operation(
            operation="delete", collection="categorias", categoria_id=id, user_id=user_id
        )
        categoria = await self.get_by_id(id, user_id)
        if not categoria:
            return None
        if await self._has_transactions(id, user_id):
            log.warning(f"Categoria {id} tem transações vinculadas; exclusão recusada")
            raise ConflictError(HAS_TRANSACTIONS_MESSAGE)
        await self.db.delete(categoria)
        try:
            await self.db.flush()
        except IntegrityError as e:
            log.warning(f"Categoria {id} referenciada por outros dados: {e.orig}")
            raise ConflictError(HAS_TRANSACTIONS_MESSAGE) from e
        invalidate_opcoes_categorias_cache()
        log.info(f"Categoria {id} excluída")
        return categoria
