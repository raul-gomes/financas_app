"""Transactions service: business rules and authorization for the transactions routes.

Layering (see AGENTS.md): route -> service -> repository. The service is built per request
from the authenticated user and the request's unit of work, so every query is scoped by
``user.id`` taken from the verified token, never from client input. It never commits: the
unit of work does it once, when the route returns.
"""

from datetime import date, datetime

from app.core.errors import NotFoundError, ValidationError
from app.core.unit_of_work import UnitOfWork
from app.db.models.transaction import TransactionORM
from app.db.models.user import UserORM
from app.db.repositories.transaction import (
    InvalidCursorError,
    TransacaoRepository,
    TransactionCursor,
    TransactionFilters,
)
from app.schemas.transaction import (
    DuplicateCheckResponse,
    DuplicateInfo,
    ResolveDuplicatesRequest,
    ResolveDuplicatesResponse,
    SingleDuplicateCheckItem,
    SingleDuplicateCheckResult,
    TransacaoCreate,
    TransacaoPageResponse,
    TransacaoResponse,
    TransacaoUpdate,
)
from app.services.limit_alert_service import trigger_limit_evaluation

NOT_FOUND_MESSAGE = "Transação não encontrada"
INVALID_CURSOR_MESSAGE = "Cursor inválido"
RESOLUTION_KEEP_BOTH = "keep_both"
RESOLUTION_KEEP_NEW = "keep_new"
RESOLUTION_KEEP_EXISTING = "keep_existing"


class TransactionService:
    """Use cases over the authenticated user's transactions."""

    def __init__(self, uow: UnitOfWork, user: UserORM) -> None:
        """Binds the service to the request's unit of work and authenticated user."""
        self.uow = uow
        self.user = user
        self.repo = TransacaoRepository(uow.session)

    def _evaluate_limits_after_commit(self, transaction_date: datetime) -> None:
        """Schedules the limit-alert evaluation for the transaction's month, after commit."""
        year, month = transaction_date.year, transaction_date.month
        user_id = self.user.id
        session = self.uow.session

        async def evaluate() -> None:
            await trigger_limit_evaluation(session, user_id, year=year, month=month)

        self.uow.after_commit(evaluate)

    async def create(self, payload: TransacaoCreate) -> TransactionORM:
        """Creates a transaction (and its installments) for the authenticated user."""
        transaction = await self.repo.create(payload, self.user.id)
        self._evaluate_limits_after_commit(transaction.transaction_date)
        return transaction

    async def get(self, transaction_id: int) -> TransactionORM:
        """Returns one of the user's transactions or raises NotFoundError."""
        transaction = await self.repo.get_by_id(transaction_id, self.user.id)
        if transaction is None:
            raise NotFoundError(NOT_FOUND_MESSAGE)
        return transaction

    async def update(self, transaction_id: int, payload: TransacaoUpdate) -> TransactionORM:
        """Updates one of the user's transactions or raises NotFoundError."""
        transaction = await self.repo.update(transaction_id, payload, self.user.id)
        if transaction is None:
            raise NotFoundError(NOT_FOUND_MESSAGE)
        self._evaluate_limits_after_commit(transaction.transaction_date)
        return transaction

    async def delete(self, transaction_id: int) -> TransactionORM:
        """Deletes one of the user's transactions or raises NotFoundError."""
        deleted = await self.repo.delete(transaction_id, self.user.id)
        if deleted is None:
            raise NotFoundError(NOT_FOUND_MESSAGE)
        self._evaluate_limits_after_commit(deleted.transaction_date)
        return deleted

    async def list_legacy(
        self,
        start_date: datetime | None,
        end_date: datetime | None,
        limit: int,
        offset: int,
    ) -> list[TransactionORM]:
        """Legacy limit/offset listing (kept for API compatibility; prefer :meth:`list_page`)."""
        return await self.repo.get_all(
            start_date, end_date, limit=limit, offset=offset, user_id=self.user.id
        )

    async def list_page(
        self, filters: TransactionFilters, limit: int, cursor: str | None
    ) -> TransacaoPageResponse:
        """Returns one keyset page of the user's transactions (date desc, id desc).

        Raises:
            ValidationError: when ``cursor`` is malformed (400).
        """
        try:
            position = TransactionCursor.decode(cursor) if cursor else None
        except InvalidCursorError as exc:
            raise ValidationError(INVALID_CURSOR_MESSAGE) from exc
        page = await self.repo.list_page(self.user.id, filters, limit, position)
        return TransacaoPageResponse(
            items=[TransacaoResponse.model_validate(row) for row in page.items],
            total=page.total,
            limit=limit,
            has_more=page.next_cursor is not None,
            next_cursor=page.next_cursor.encode() if page.next_cursor else None,
        )

    async def check_duplicates(
        self, items: list[SingleDuplicateCheckItem]
    ) -> DuplicateCheckResponse:
        """Looks for same-day, same-amount transactions of the user for each item."""
        results: list[SingleDuplicateCheckResult] = []
        for item in items:
            duplicates = await self.repo.check_duplicates(
                item.transaction_date, item.amount, self.user.id
            )
            info = [self._duplicate_info(t) for t in duplicates]
            results.append(
                SingleDuplicateCheckResult(
                    index=item.index, has_duplicate=len(info) > 0, duplicates=info
                )
            )
        return DuplicateCheckResponse(results=results)

    async def resolve_duplicates(
        self, payload: ResolveDuplicatesRequest
    ) -> ResolveDuplicatesResponse:
        """Applies keep_both / keep_new / keep_existing, only ever deleting the user's rows."""
        resolved = deleted = kept = 0
        for resolution in payload.resolutions:
            existing = await self.repo.get_by_id(resolution.existing_id, self.user.id)
            new = await self.repo.get_by_id(resolution.new_id, self.user.id)

            resolved += 1
            if resolution.action == RESOLUTION_KEEP_BOTH:
                kept += 1
            elif resolution.action == RESOLUTION_KEEP_NEW and existing:
                await self.repo.delete(existing.id, self.user.id)
                deleted += 1
            elif resolution.action == RESOLUTION_KEEP_EXISTING and new:
                await self.repo.delete(new.id, self.user.id)
                deleted += 1
        return ResolveDuplicatesResponse(resolved=resolved, deleted=deleted, kept=kept)

    @staticmethod
    def _duplicate_info(transaction: TransactionORM) -> DuplicateInfo:
        """Maps an ORM transaction to the duplicate-check DTO."""
        return DuplicateInfo(
            id=transaction.id,
            description=transaction.description,
            amount=transaction.amount,
            transaction_date=transaction.transaction_date,
            type=transaction.type,
            entity_type=transaction.entity_type,
            category_name=transaction.category.name if transaction.category else None,
            subcategory_name=transaction.subcategory.name if transaction.subcategory else None,
            payment_method=transaction.payment_method,
            created_at=transaction.created_at,
        )


def single_check_item(transaction_date: date, amount: float) -> SingleDuplicateCheckItem:
    """Builds the index-0 item used by the single (non-bulk) duplicate check."""
    return SingleDuplicateCheckItem(index=0, transaction_date=transaction_date, amount=amount)
