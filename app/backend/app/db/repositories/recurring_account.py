import calendar
from datetime import datetime
from uuid import uuid4

from fastapi import Depends
from sqlalchemy import and_, func, insert, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.errors import ValidationError
from app.db.models.recurring_account import RecurringAccountORM
from app.db.models.transaction import TransactionORM
from app.logger import log_database_operation, logger
from app.schemas.recurring_account import (
    ContaRecorrenteCreate,
    ContaRecorrenteUpdate,
)

# Account fields copied to its installments from the current month on when edited.
PROPAGATED_FIELDS = (
    "amount",
    "description",
    "category_id",
    "subcategory_id",
    "entity_type",
    "payment_method",
    "bank_code",
)


def _current_month_start() -> datetime:
    """First instant of the current month: installments from here on are "future"."""
    return datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)


class ContaRecorrenteRepository:
    """Contas recorrentes e suas parcelas. Só faz flush: o commit é da unit of work do request."""

    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db

    # ── CRUD ──────────────────────────────────────────────

    async def create(self, obj_in: ContaRecorrenteCreate, user_id: int) -> RecurringAccountORM:
        log = log_database_operation(
            operation="create",
            collection="contas_recorrentes",
            payload=obj_in.model_dump(),
            user_id=user_id,
        )
        inst = RecurringAccountORM(
            user_id=user_id,
            description=obj_in.description,
            amount=obj_in.amount,
            due_day=obj_in.due_day,
            category_id=obj_in.category_id,
            subcategory_id=obj_in.subcategory_id,
            entity_type=obj_in.entity_type,
            payment_method=obj_in.payment_method,
            bank_code=obj_in.bank_code,
            start_date=obj_in.start_date,
            end_date=obj_in.end_date,
            active=obj_in.active,
            total_installments=obj_in.total_installments,
            group_id=str(uuid4()),
        )
        self.db.add(inst)
        try:
            await self.db.flush()
            await self.db.refresh(inst)
        except IntegrityError as exc:
            raise ValidationError("Erro ao criar conta recorrente") from exc

        # Auto-generate 12 monthly installments
        try:
            geradas = await self._generate_installments(inst, user_id)
            log.info(
                f"Conta recorrente {inst.id} criada com {geradas}/{inst.total_installments} parcelas geradas"
            )
        except SQLAlchemyError as e:
            log.error(f"Erro ao gerar parcelas para conta {inst.id}: {e}")
            raise

        await self._set_remaining_installments(inst)
        return inst

    async def get_all(
        self,
        entity_type: str | None = None,
        limit: int = 100,
        offset: int = 0,
        *,
        user_id: int,
    ) -> list[RecurringAccountORM]:
        stmt = (
            select(RecurringAccountORM)
            .order_by(RecurringAccountORM.start_date.desc())
            .limit(limit)
            .offset(offset)
        )
        stmt = stmt.where(RecurringAccountORM.user_id == user_id)
        if entity_type:
            stmt = stmt.where(RecurringAccountORM.entity_type == entity_type)
        result = await self.db.execute(stmt)
        contas = list(result.unique().scalars().all())
        await self._set_all_remaining_installments(contas)
        return contas

    async def get_by_id(self, id: int, user_id: int) -> RecurringAccountORM | None:
        stmt = select(RecurringAccountORM).where(RecurringAccountORM.id == id)
        stmt = stmt.where(RecurringAccountORM.user_id == user_id)
        result = await self.db.execute(stmt)
        conta = result.scalars().first()
        if conta:
            await self._set_remaining_installments(conta)
        return conta

    async def update(
        self, id: int, obj_in: ContaRecorrenteUpdate, user_id: int
    ) -> RecurringAccountORM | None:
        conta = await self.get_by_id(id, user_id)
        if not conta:
            return None

        was_active = conta.active
        data = obj_in.model_dump(exclude_unset=True)
        field_map = {
            "description": "description",
            "amount": "amount",
            "due_day": "due_day",
            "category_id": "category_id",
            "subcategory_id": "subcategory_id",
            "entity_type": "entity_type",
            "payment_method": "payment_method",
            "bank_code": "bank_code",
            "start_date": "start_date",
            "end_date": "end_date",
            "active": "active",
        }

        for field, val in data.items():
            orm_field = field_map.get(field, field)
            setattr(conta, orm_field, val)

        # Edited fields apply to the installments from the current month on; past ones keep theirs
        propagated = {field: data[field] for field in PROPAGATED_FIELDS if field in data}
        if propagated and data.get("active") is not False:
            await self._update_future_transactions(conta, propagated)

        # If deactivating, cancel future transactions
        if was_active and data.get("active") is False:
            try:
                await self._cancel_future_transactions(conta)
            except SQLAlchemyError as e:
                logger.error(f"Erro ao cancelar transações futuras da conta {conta.id}: {e}")
                raise

        try:
            await self.db.flush()
            await self.db.refresh(conta)
            await self._set_remaining_installments(conta)
            return conta
        except IntegrityError as exc:
            raise ValidationError("Erro ao atualizar conta recorrente") from exc

    async def delete(self, id: int, user_id: int) -> RecurringAccountORM | None:
        conta = await self.get_by_id(id, user_id)
        if not conta:
            return None

        # Delete all linked transactions first (FK constraint)
        stmt = select(TransactionORM).where(TransactionORM.recurring_account_id == conta.id)
        result = await self.db.execute(stmt)
        transacoes = list(result.unique().scalars().all())
        for t in transacoes:
            await self.db.delete(t)

        await self.db.delete(conta)
        await self.db.flush()
        return conta

    # ── 12-installment generation ─────────────────────────

    async def _generate_installments(self, conta: RecurringAccountORM, user_id: int) -> int:
        """Generate N monthly transaction installments for a recurring account using bulk insert."""
        from dateutil.relativedelta import relativedelta

        # Calculate all installment dates first
        dates_to_insert = []
        current = conta.start_date.replace(day=1)
        gid_str = str(conta.group_id)

        for i in range(conta.total_installments):
            year = current.year
            month = current.month
            ultimo_dia = calendar.monthrange(year, month)[1]
            day = min(conta.due_day, ultimo_dia)
            transaction_date = datetime(year, month, day, 0, 0, 0)

            # Skip if this installment is past end_date
            if conta.end_date and transaction_date > conta.end_date:
                break

            dates_to_insert.append(
                {
                    "installment_number": i + 1,
                    "transaction_date": transaction_date,
                }
            )

            current = current + relativedelta(months=1)

        if not dates_to_insert:
            return 0

        # One portable bulk INSERT (SQLite and Postgres): months that already have a
        # transaction of this group are skipped (checked with a single SELECT).
        existing_months = await self._existing_months(conta.group_id, dates_to_insert)
        values_list = [
            {
                "amount": conta.amount,
                "description": conta.description,
                "installment_number": d["installment_number"],
                "total_installments": conta.total_installments,
                "transaction_date": d["transaction_date"],
                "type": "expense",
                "entity_type": conta.entity_type,
                "payment_method": conta.payment_method,
                "category_id": conta.category_id,
                "subcategory_id": conta.subcategory_id,
                "group_id": gid_str,
                "recurring_account_id": conta.id,
                "user_id": user_id,
            }
            for d in dates_to_insert
            if (d["transaction_date"].year, d["transaction_date"].month) not in existing_months
        ]
        if not values_list:
            return 0

        await self.db.execute(insert(TransactionORM), values_list)
        await self.db.flush()
        return len(values_list)

    async def _existing_months(self, group_id: str, dates: list[dict]) -> set[tuple[int, int]]:
        """(year, month) pairs of the group's transactions inside the span of ``dates``."""
        first = min(d["transaction_date"] for d in dates).replace(day=1)
        last = max(d["transaction_date"] for d in dates)
        rows = await self.db.execute(
            select(TransactionORM.transaction_date).where(
                TransactionORM.group_id == str(group_id),
                TransactionORM.transaction_date >= first,
                TransactionORM.transaction_date <= last.replace(hour=23, minute=59, second=59),
            )
        )
        return {(day.year, day.month) for day in rows.scalars()}

    async def renew(self, conta_id: int, user_id: int) -> RecurringAccountORM | None:
        """Re-activate and generate 12 more installments from current month."""
        conta = await self.get_by_id(conta_id, user_id)
        if not conta:
            return None

        from dateutil.relativedelta import relativedelta

        # Set as active
        conta.active = True

        # Set start_date to current month (or next if this month already has a tx)
        now = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        has_current = await self._check_transaction_exists(conta.group_id, now.year, now.month)
        new_start = now + relativedelta(months=1) if has_current else now
        conta.start_date = new_start

        # Generate 12 new installments
        try:
            await self._generate_installments(conta, user_id)
        except SQLAlchemyError as e:
            logger.error(f"Erro ao renovar conta recorrente {conta.id}: {e}")
            raise

        await self.db.flush()
        await self.db.refresh(conta)
        await self._set_remaining_installments(conta)
        return conta

    # ── Helpers ───────────────────────────────────────────

    async def _update_future_transactions(self, conta: RecurringAccountORM, changes: dict) -> None:
        """Applies the account's edited fields to its installments from the current month on."""
        stmt = select(TransactionORM).where(
            TransactionORM.recurring_account_id == conta.id,
            TransactionORM.transaction_date >= _current_month_start(),
        )
        futures = list((await self.db.execute(stmt)).unique().scalars().all())
        for transaction in futures:
            for field, value in changes.items():
                setattr(transaction, field, value)
        if futures:
            await self.db.flush()

    async def _cancel_future_transactions(self, conta: RecurringAccountORM) -> int:
        """Delete all future transactions for this recurring account."""
        stmt = select(TransactionORM).where(
            TransactionORM.recurring_account_id == conta.id,
            TransactionORM.transaction_date >= _current_month_start(),
        )
        result = await self.db.execute(stmt)
        futures = list(result.unique().scalars().all())

        for t in futures:
            await self.db.delete(t)

        count = len(futures)
        if count > 0:
            await self.db.flush()
        return count

    async def _set_remaining_installments(self, conta: RecurringAccountORM) -> None:
        """Set computed remaining_installments on a single conta ORM object."""
        now = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        stmt = select(func.count(TransactionORM.id)).where(
            TransactionORM.recurring_account_id == conta.id,
            TransactionORM.transaction_date >= now,
        )
        result = await self.db.execute(stmt)
        conta.remaining_installments = result.scalar() or 0

    async def _set_all_remaining_installments(self, contas: list[RecurringAccountORM]) -> None:
        """Batch-set remaining_installments for a list of contas."""
        if not contas:
            return
        ids = [c.id for c in contas]
        now = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        stmt = (
            select(
                TransactionORM.recurring_account_id,
                func.count(TransactionORM.id),
            )
            .where(
                TransactionORM.recurring_account_id.in_(ids),
                TransactionORM.transaction_date >= now,
            )
            .group_by(TransactionORM.recurring_account_id)
        )

        result = await self.db.execute(stmt)
        future_map = dict(result.all())

        for c in contas:
            c.remaining_installments = future_map.get(c.id, 0)

    async def _check_transaction_exists(self, group_id: str, year: int, month: int) -> bool:
        try:
            gid_str = str(group_id)
        except (ValueError, AttributeError):
            return False

        next_month_start = datetime(year, month + 1, 1) if month < 12 else datetime(year + 1, 1, 1)

        stmt = select(TransactionORM.id).where(
            and_(
                TransactionORM.group_id == gid_str,
                TransactionORM.transaction_date >= datetime(year, month, 1),
                TransactionORM.transaction_date < next_month_start,
            )
        )
        result = await self.db.execute(stmt)
        return result.scalars().first() is not None
