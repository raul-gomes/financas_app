"""Limits service: category limits, monthly spending and the bulk limits update.

Layering (see AGENTS.md): route -> service -> repository. Every repository call receives
``user.id`` from the verified token. Writes only flush: the unit of work commits once when the
route returns. In the bulk update each item runs inside a savepoint, so one failing item is
reported in ``errors`` without losing the items that succeeded.
"""

from datetime import datetime
from typing import Any

from sqlalchemy.exc import SQLAlchemyError

from app.core.errors import DomainError
from app.core.unit_of_work import UnitOfWork
from app.db.models.user import UserORM
from app.db.repositories.category import CategoriaRepository
from app.db.repositories.limits import LimitsRepository
from app.db.repositories.subcategory import SubcategoriaRepository
from app.logger import log_database_operation
from app.schemas.categories import CategoriaCreate, CategoriaUpdate
from app.schemas.limits import (
    CategoriaLimiteUpdate,
    LimitsUpdatePayload,
    LimitsUpdateResponse,
    SubcategoriaLimiteUpdate,
)
from app.schemas.notifications import CategoryRiskResponse
from app.schemas.subcategory import SubcategoriaCreate, SubcategoriaUpdate

GENERIC_ITEM_ERROR = "erro interno"
BULK_ITEM_ERRORS = (DomainError, ValueError, SQLAlchemyError)
RISK_THRESHOLDS = (80, 90, 100)
PERCENT_FACTOR = 100
RISK_SEVERITY_BY_THRESHOLD = {80: "warning", 90: "critical", 100: "destructive"}
UNKNOWN_CATEGORY_NAME = "Categoria"
BULK_SUCCESS_MESSAGE = "Limites atualizados com sucesso"


def client_error_text(exc: Exception) -> str:
    """Text that is safe to show the client for one failed bulk item.

    Only deliberate domain messages (DomainError message, ValueError raised by this
    service) are passed through; database errors become a generic text.
    """
    if isinstance(exc, DomainError):
        return exc.message
    if isinstance(exc, ValueError):
        return str(exc)
    return GENERIC_ITEM_ERROR


class LimitsService:
    """Use cases over the authenticated user's limits."""

    def __init__(self, uow: UnitOfWork, user: UserORM) -> None:
        """Binds the service to the request's unit of work and authenticated user."""
        self.uow = uow
        self.user = user
        self.repo = LimitsRepository(uow.session)
        self.categories = CategoriaRepository(uow.session)
        self.subcategories = SubcategoriaRepository(uow.session)

    async def list_all(self) -> list[dict[str, Any]]:
        """Every category with its subcategories, shaped for the limits screen."""
        return await self.repo.get_all_limits(self.user.id)

    async def with_spending(self, year: int, month: int, entity_type: str | None) -> dict[str, Any]:
        """Categories with limit, spent, remaining and percent used in the month."""
        return await self.repo.get_limits_with_spending(year, month, self.user.id, entity_type)

    async def category_risk(
        self, category_id: int, amount: float | None, now: datetime | None = None
    ) -> CategoryRiskResponse:
        """Risk of exceeding a category's limit this month, projecting the typed ``amount``.

        Unknown categories (or ones of other users) answer a neutral "no limit" payload.
        """
        now = now or datetime.now()
        data = await self.repo.get_limits_with_spending(now.year, now.month, self.user.id, None)
        amount_value = amount or 0.0
        for cat in data["categories"]:
            if cat["id"] != category_id:
                continue
            limit = cat["limit"]
            spent = cat["spent"]
            projected_spent = spent + amount_value
            projected_percent = (
                round((projected_spent / limit) * PERCENT_FACTOR, 1) if limit > 0 else 0.0
            )
            thresholds_hit = [t for t in RISK_THRESHOLDS if projected_percent >= t]
            return CategoryRiskResponse(
                category_id=cat["id"],
                category_name=cat["category_name"],
                limit=limit,
                spent=spent,
                amount=amount_value,
                projected_spent=round(projected_spent, 2),
                percent_used=cat["percent_used"],
                projected_percent_used=projected_percent,
                is_over_limit=limit > 0 and projected_percent >= RISK_THRESHOLDS[-1],
                severity=RISK_SEVERITY_BY_THRESHOLD[thresholds_hit[-1]] if thresholds_hit else None,
                thresholds_hit=thresholds_hit,
            )
        return CategoryRiskResponse(
            category_id=category_id,
            category_name=UNKNOWN_CATEGORY_NAME,
            limit=0.0,
            spent=0.0,
            projected_spent=0.0,
            percent_used=0.0,
            projected_percent_used=0.0,
            is_over_limit=False,
        )

    async def bulk_update(self, payload: LimitsUpdatePayload) -> LimitsUpdateResponse:
        """Deletes, creates and modifies categories/subcategories in one request.

        Item failures are collected in ``errors`` (``success`` turns false) while the other
        items stay in the unit of work's transaction.
        """
        user_id = self.user.id
        log = log_database_operation(
            operation="bulk_update_limits",
            collection="categorias",
            payload=payload.model_dump(),
            user_id=user_id,
        )
        response = LimitsUpdateResponse(success=True, message=BULK_SUCCESS_MESSAGE)

        for cat_id in payload.deleted:
            counters = response.model_copy()
            try:
                async with self.uow.session.begin_nested():
                    if await self.categories.get_by_id(cat_id, user_id):
                        await self.categories.delete(cat_id, user_id, commit=False)
                        response.deleted_categories += 1
            except BULK_ITEM_ERRORS as e:
                self._restore_counters(response, counters)
                response.errors.append(
                    f"Erro ao excluir categoria ID {cat_id}: {client_error_text(e)}"
                )
                log.error(f"Erro ao excluir categoria: {e}")

        for new_cat in payload.new:
            counters = response.model_copy()
            try:
                async with self.uow.session.begin_nested():
                    await self._create_new_category(new_cat, response, user_id)
            except BULK_ITEM_ERRORS as e:
                self._restore_counters(response, counters)
                response.errors.append(
                    f"Erro ao criar categoria '{new_cat.category_name}': {client_error_text(e)}"
                )
                log.error(f"Erro ao criar categoria: {e}")

        for mod_cat in payload.modified:
            counters = response.model_copy()
            try:
                async with self.uow.session.begin_nested():
                    await self._update_existing_category(mod_cat, response, user_id)
            except BULK_ITEM_ERRORS as e:
                self._restore_counters(response, counters)
                response.errors.append(
                    f"Erro ao atualizar categoria ID {mod_cat.id}: {client_error_text(e)}"
                )
                log.error(f"Erro ao atualizar categoria: {e}")

        if response.errors:
            response.success = False
            response.message = f"Operação concluída com {len(response.errors)} erro(s)"

        log.info(
            f"Bulk update concluído: {response.created_categories} criadas, "
            f"{response.updated_categories} atualizadas"
        )
        return response

    @staticmethod
    def _restore_counters(response: LimitsUpdateResponse, before: LimitsUpdateResponse) -> None:
        """Undoes the counts of a failed item: its savepoint was rolled back."""
        response.created_categories = before.created_categories
        response.updated_categories = before.updated_categories
        response.deleted_categories = before.deleted_categories
        response.created_subcategories = before.created_subcategories
        response.updated_subcategories = before.updated_subcategories

    async def _create_new_category(
        self, new_cat: CategoriaLimiteUpdate, response: LimitsUpdateResponse, user_id: int
    ) -> None:
        """Cria uma nova categoria com suas subcategorias."""
        existing = await self.categories.get_by_nome_and_entity_type(
            new_cat.category_name, new_cat.entity_type, user_id
        )
        if existing:
            raise ValueError(
                f"Categoria '{new_cat.category_name}' com tipo '{new_cat.entity_type}' já existe"
            )

        categoria = await self.categories.create(
            user_id,
            CategoriaCreate(
                category_name=new_cat.category_name,
                entity_type=new_cat.entity_type,
                limit=new_cat.limit,
                subcategories=[],  # created one by one below
            ),
            commit=False,
        )
        response.created_categories += 1

        for sub_data in new_cat.subcategories:
            if sub_data.subcategory_name.strip():
                await self.subcategories.create(
                    categoria.id,
                    user_id,
                    SubcategoriaCreate(subcategory_name=sub_data.subcategory_name),
                    commit=False,
                )
                response.created_subcategories += 1

    async def _update_existing_category(
        self, mod_cat: CategoriaLimiteUpdate, response: LimitsUpdateResponse, user_id: int
    ) -> None:
        """Atualiza uma categoria existente e suas subcategorias."""
        if not mod_cat.id:
            raise ValueError("ID da categoria é obrigatório para atualização")

        categoria = await self.categories.get_by_id(mod_cat.id, user_id)
        if not categoria:
            raise ValueError(f"Categoria ID {mod_cat.id} não encontrada")

        await self.categories.update(
            mod_cat.id,
            user_id,
            CategoriaUpdate(
                category_name=mod_cat.category_name,
                entity_type=mod_cat.entity_type,
                limit=mod_cat.limit,
                subcategories=[],  # processed one by one below
            ),
            commit=False,
        )
        response.updated_categories += 1

        await self._process_subcategories(mod_cat.id, mod_cat.subcategories, response, user_id)

    async def _process_subcategories(
        self,
        categoria_id: int,
        subcategorias: list[SubcategoriaLimiteUpdate],
        response: LimitsUpdateResponse,
        user_id: int,
    ) -> None:
        """Processa subcategorias de uma categoria (novas e atualizações)."""
        for sub_data in subcategorias:
            if not sub_data.subcategory_name.strip():
                continue

            if sub_data.id:
                updated_sub = await self.subcategories.update(
                    sub_data.id,
                    user_id,
                    SubcategoriaUpdate(subcategory_name=sub_data.subcategory_name),
                    commit=False,
                )
                if updated_sub:
                    response.updated_subcategories += 1
            else:
                await self.subcategories.create(
                    categoria_id,
                    user_id,
                    SubcategoriaCreate(subcategory_name=sub_data.subcategory_name),
                    commit=False,
                )
                response.created_subcategories += 1
