import calendar
from typing import List, Optional
from datetime import datetime, date
from uuid import uuid4

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from sqlalchemy.exc import IntegrityError

from app.core.database import get_session
from app.db.models.recurring_account import RecurringAccountORM
from app.db.models.transaction import TransactionORM
from app.schemas.recurring_account import ContaRecorrenteCreate, ContaRecorrenteUpdate, GenerateRequest
from app.logger import log_database_operation


class ContaRecorrenteRepository:
    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db

    # ── CRUD ──────────────────────────────────────────────

    async def create(self, obj_in: ContaRecorrenteCreate) -> RecurringAccountORM:
        log = log_database_operation(
            operation="create", collection="contas_recorrentes", payload=obj_in.model_dump()
        )
        inst = RecurringAccountORM(
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
            await self.db.commit()
            await self.db.refresh(inst)
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Erro ao criar conta recorrente")

        # Auto-generate 12 monthly installments
        try:
            geradas = await self._generate_installments(inst)
            log.info(
                f"Conta recorrente {inst.id} criada com {geradas}/{inst.total_installments} parcelas geradas"
            )
        except Exception as e:
            log.error(f"Erro ao gerar parcelas para conta {inst.id}: {e}")
            raise

        await self._set_remaining_installments(inst)
        return inst

    async def get_all(self, entity_type: Optional[str] = None) -> List[RecurringAccountORM]:
        stmt = (
            select(RecurringAccountORM)
            .options(
                selectinload(RecurringAccountORM.category),
                selectinload(RecurringAccountORM.subcategory),
            )
            .order_by(RecurringAccountORM.start_date.desc())
        )
        if entity_type:
            stmt = stmt.where(RecurringAccountORM.entity_type == entity_type)
        result = await self.db.execute(stmt)
        contas = list(result.unique().scalars().all())
        await self._set_all_remaining_installments(contas)
        return contas

    async def get_by_id(self, id: int) -> Optional[RecurringAccountORM]:
        stmt = (
            select(RecurringAccountORM)
            .options(
                selectinload(RecurringAccountORM.category),
                selectinload(RecurringAccountORM.subcategory),
            )
            .where(RecurringAccountORM.id == id)
        )
        result = await self.db.execute(stmt)
        conta = result.scalars().first()
        if conta:
            await self._set_remaining_installments(conta)
        return conta

    async def update(self, id: int, obj_in: ContaRecorrenteUpdate) -> Optional[RecurringAccountORM]:
        conta = await self.get_by_id(id)
        if not conta:
            return None

        was_active = conta.active
        data = obj_in.model_dump(exclude_unset=True)
        field_map = {
            'description': 'description',
            'amount': 'amount',
            'due_day': 'due_day',
            'category_id': 'category_id',
            'subcategory_id': 'subcategory_id',
            'entity_type': 'entity_type',
            'payment_method': 'payment_method',
            'bank_code': 'bank_code',
            'start_date': 'start_date',
            'end_date': 'end_date',
            'active': 'active',
        }

        for field, val in data.items():
            orm_field = field_map.get(field, field)
            setattr(conta, orm_field, val)

        # If deactivating, cancel future transactions
        if was_active and data.get("active") is False:
            try:
                removidas = await self._cancel_future_transactions(conta)
            except Exception as e:
                await self.db.rollback()
                raise HTTPException(status_code=500, detail=f"Erro ao cancelar futuras: {e}")

        try:
            await self.db.commit()
            await self.db.refresh(conta)
            await self._set_remaining_installments(conta)
            return conta
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Erro ao atualizar conta recorrente")

    async def delete(self, id: int) -> Optional[RecurringAccountORM]:
        conta = await self.get_by_id(id)
        if not conta:
            return None

        # Delete all linked transactions first (FK constraint)
        stmt = select(TransactionORM).where(
            TransactionORM.recurring_account_id == conta.id
        )
        result = await self.db.execute(stmt)
        transacoes = list(result.unique().scalars().all())
        for t in transacoes:
            await self.db.delete(t)

        await self.db.delete(conta)
        await self.db.commit()
        return conta

    # ── 12‑installment generation ─────────────────────────

    async def _generate_installments(self, conta: RecurringAccountORM) -> int:
        """Generate N monthly transaction installments for a recurring account."""
        from dateutil.relativedelta import relativedelta

        geradas = 0
        current = conta.start_date.replace(day=1)

        for i in range(conta.total_installments):
            year = current.year
            month = current.month
            ultimo_dia = calendar.monthrange(year, month)[1]
            day = min(conta.due_day, ultimo_dia)
            transaction_date = datetime(year, month, day, 0, 0, 0)

            # Skip if this installment is past end_date
            if conta.end_date and transaction_date > conta.end_date:
                break

            already_exists = await self._check_transaction_exists(
                conta.group_id, year, month
            )
            if not already_exists:
                transacao = TransactionORM(
                    amount=conta.amount,
                    description=conta.description,
                    installment_number=i + 1,
                    total_installments=conta.total_installments,
                    transaction_date=transaction_date,
                    type="expense",
                    entity_type=conta.entity_type,
                    payment_method=conta.payment_method,
                    category_id=conta.category_id,
                    subcategory_id=conta.subcategory_id,
                    group_id=str(conta.group_id),
                    recurring_account_id=conta.id,
                )
                self.db.add(transacao)
                geradas += 1

            current = current + relativedelta(months=1)

        if geradas > 0:
            await self.db.commit()
        return geradas

    async def renew(self, conta_id: int) -> Optional[RecurringAccountORM]:
        """Re‑activate and generate 12 more installments from current month."""
        conta = await self.get_by_id(conta_id)
        if not conta:
            return None

        from dateutil.relativedelta import relativedelta

        # Set as active
        conta.active = True

        # Set start_date to current month (or next if this month already has a tx)
        now = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        has_current = await self._check_transaction_exists(
            conta.group_id, now.year, now.month
        )
        if has_current:
            new_start = now + relativedelta(months=1)
        else:
            new_start = now
        conta.start_date = new_start

        # Generate 12 new installments
        try:
            geradas = await self._generate_installments(conta)
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(status_code=500, detail=f"Erro ao renovar: {e}")

        await self.db.commit()
        await self.db.refresh(conta)
        await self._set_remaining_installments(conta)
        return conta

    # ── Helpers ───────────────────────────────────────────

    async def _cancel_future_transactions(self, conta: RecurringAccountORM) -> int:
        """Delete all future transactions for this recurring account."""
        now = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        stmt = select(TransactionORM).where(
            TransactionORM.recurring_account_id == conta.id,
            TransactionORM.transaction_date >= now,
        )
        result = await self.db.execute(stmt)
        futures = list(result.unique().scalars().all())

        for t in futures:
            await self.db.delete(t)

        count = len(futures)
        if count > 0:
            await self.db.commit()
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

    async def _set_all_remaining_installments(self, contas: List[RecurringAccountORM]) -> None:
        """Batch-set remaining_installments for a list of contas."""
        if not contas:
            return
        ids = [c.id for c in contas]
        now = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        stmt = select(
            TransactionORM.recurring_account_id,
            func.count(TransactionORM.id),
        ).where(
            TransactionORM.recurring_account_id.in_(ids),
            TransactionORM.transaction_date >= now,
        ).group_by(TransactionORM.recurring_account_id)

        result = await self.db.execute(stmt)
        future_map = dict(result.all())

        for c in contas:
            c.remaining_installments = future_map.get(c.id, 0)

    # ── Legacy generate (kept for Compatibility) ──────────

    async def generate_pending_transactions(self, req: GenerateRequest) -> tuple[int, list[str]]:
        log = log_database_operation(
            operation="generate",
            collection="contas_recorrentes",
            payload={"start_date": str(req.start_date), "end_date": str(req.end_date)},
        )

        stmt = select(RecurringAccountORM).where(
            RecurringAccountORM.active == True,
            RecurringAccountORM.start_date <= req.end_date,
        )
        result = await self.db.execute(stmt)
        contas = list(result.unique().scalars().all())

        geradas = 0
        detalhes = []

        for conta in contas:
            if conta.end_date and conta.end_date < req.start_date:
                continue

            current_date = req.start_date
            while current_date <= req.end_date:
                year = current_date.year
                month = current_date.month

                ultimo_dia = calendar.monthrange(year, month)[1]
                day = min(conta.due_day, ultimo_dia)
                transaction_date = datetime(year, month, day, 0, 0, 0)

                if transaction_date < req.start_date or transaction_date > req.end_date:
                    from dateutil.relativedelta import relativedelta
                    current_date = current_date.replace(day=1) + relativedelta(months=1)
                    continue

                try:
                    already_exists = await self._check_transaction_exists(conta.group_id, year, month)
                except Exception as e:
                    log.error(f"Erro ao verificar transacao existente para {conta.description}: {e}")
                    already_exists = True
                    from dateutil.relativedelta import relativedelta
                    current_date = current_date.replace(day=1) + relativedelta(months=1)
                    continue

                if not already_exists:
                    try:
                        transacao = TransactionORM(
                            amount=conta.amount,
                            description=conta.description,
                            installment_number=1,
                            total_installments=1,
                            transaction_date=transaction_date,
                            type="expense",
                            entity_type=conta.entity_type,
                            payment_method=conta.payment_method,
                            category_id=conta.category_id,
                            subcategory_id=conta.subcategory_id,
                            group_id=str(conta.group_id),
                            recurring_account_id=conta.id,
                        )
                        self.db.add(transacao)
                        geradas += 1
                        detalhes.append(
                            f"{conta.description} - R$ {conta.amount:.2f} em {transaction_date.strftime('%d/%m/%Y')}"
                        )
                    except Exception as e:
                        log.error(f"Erro ao gerar transacao recorrente para {conta.description}: {e}")
                        continue

                from dateutil.relativedelta import relativedelta
                current_date = current_date.replace(day=1) + relativedelta(months=1)

        if geradas > 0:
            try:
                await self.db.commit()
                log.info(f"{geradas} transacoes recorrentes geradas")
            except Exception as e:
                await self.db.rollback()
                log.error(f"Erro ao commit transacoes recorrentes: {e}", exc_info=True)
                raise

        return geradas, detalhes

    async def _check_transaction_exists(self, group_id: str, year: int, month: int) -> bool:
        try:
            gid_str = str(group_id)
        except (ValueError, AttributeError):
            return False

        if month < 12:
            next_month_start = datetime(year, month + 1, 1)
        else:
            next_month_start = datetime(year + 1, 1, 1)

        stmt = select(TransactionORM.id).where(
            and_(
                TransactionORM.group_id == gid_str,
                TransactionORM.transaction_date >= datetime(year, month, 1),
                TransactionORM.transaction_date < next_month_start,
            )
        )
        try:
            result = await self.db.execute(stmt)
            return result.scalars().first() is not None
        except Exception:
            return False
