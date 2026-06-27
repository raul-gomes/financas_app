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
from app.db.models.conta_recorrente import ContaRecorrenteORM
from app.db.models.transacao import TransacaoORM
from app.schemas.conta_recorrente import ContaRecorrenteCreate, ContaRecorrenteUpdate, GenerateRequest
from app.logger import log_database_operation


class ContaRecorrenteRepository:
    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db

    # ── CRUD ──────────────────────────────────────────────

    async def create(self, obj_in: ContaRecorrenteCreate) -> ContaRecorrenteORM:
        log = log_database_operation(
            operation="create", collection="contas_recorrentes", payload=obj_in.model_dump()
        )
        inst = ContaRecorrenteORM(
            descricao=obj_in.descricao,
            valor=obj_in.valor,
            dia_vencimento=obj_in.dia_vencimento,
            categoria_id=obj_in.categoria_id,
            subcategoria_id=obj_in.subcategoria_id,
            natureza=obj_in.natureza,
            forma_pagamento=obj_in.forma_pagamento,
            bank_code=obj_in.bank_code,
            data_inicio=obj_in.data_inicio,
            data_fim=obj_in.data_fim,
            ativo=obj_in.ativo,
            total_parcelas=obj_in.total_parcelas,
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
                f"Conta recorrente {inst.id} criada com {geradas}/{inst.total_parcelas} parcelas geradas"
            )
        except Exception as e:
            log.error(f"Erro ao gerar parcelas para conta {inst.id}: {e}")
            raise

        await self._set_parcelas_restantes(inst)
        return inst

    async def get_all(self) -> List[ContaRecorrenteORM]:
        stmt = (
            select(ContaRecorrenteORM)
            .options(
                selectinload(ContaRecorrenteORM.categoria),
                selectinload(ContaRecorrenteORM.subcategoria),
            )
            .order_by(ContaRecorrenteORM.data_inicio.desc())
        )
        result = await self.db.execute(stmt)
        contas = list(result.unique().scalars().all())
        await self._set_all_parcelas_restantes(contas)
        return contas

    async def get_by_id(self, id: int) -> Optional[ContaRecorrenteORM]:
        stmt = (
            select(ContaRecorrenteORM)
            .options(
                selectinload(ContaRecorrenteORM.categoria),
                selectinload(ContaRecorrenteORM.subcategoria),
            )
            .where(ContaRecorrenteORM.id == id)
        )
        result = await self.db.execute(stmt)
        conta = result.scalars().first()
        if conta:
            await self._set_parcelas_restantes(conta)
        return conta

    async def update(self, id: int, obj_in: ContaRecorrenteUpdate) -> Optional[ContaRecorrenteORM]:
        conta = await self.get_by_id(id)
        if not conta:
            return None

        was_active = conta.ativo
        data = obj_in.model_dump(exclude_unset=True)

        for field, val in data.items():
            setattr(conta, field, val)

        # If deactivating, cancel future transactions
        if was_active and data.get("ativo") is False:
            try:
                removidas = await self._cancel_future_transactions(conta)
            except Exception as e:
                await self.db.rollback()
                raise HTTPException(status_code=500, detail=f"Erro ao cancelar futuras: {e}")

        try:
            await self.db.commit()
            await self.db.refresh(conta)
            await self._set_parcelas_restantes(conta)
            return conta
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Erro ao atualizar conta recorrente")

    async def delete(self, id: int) -> Optional[ContaRecorrenteORM]:
        conta = await self.get_by_id(id)
        if not conta:
            return None

        # Delete all linked transactions first (FK constraint)
        stmt = select(TransacaoORM).where(
            TransacaoORM.conta_recorrente_id == conta.id
        )
        result = await self.db.execute(stmt)
        transacoes = list(result.unique().scalars().all())
        for t in transacoes:
            await self.db.delete(t)

        await self.db.delete(conta)
        await self.db.commit()
        return conta

    # ── 12‑installment generation ─────────────────────────

    async def _generate_installments(self, conta: ContaRecorrenteORM) -> int:
        """Generate N monthly transaction installments for a recurring account."""
        from dateutil.relativedelta import relativedelta

        geradas = 0
        current = conta.data_inicio.replace(day=1)

        for i in range(conta.total_parcelas):
            year = current.year
            month = current.month
            ultimo_dia = calendar.monthrange(year, month)[1]
            day = min(conta.dia_vencimento, ultimo_dia)
            transacao_date = datetime(year, month, day, 0, 0, 0)

            # Skip if this installment is past data_fim
            if conta.data_fim and transacao_date > conta.data_fim:
                break

            already_exists = await self._check_transaction_exists(
                conta.group_id, year, month
            )
            if not already_exists:
                transacao = TransacaoORM(
                    valor=conta.valor,
                    descricao=conta.descricao,
                    parcela=i + 1,
                    total_parcelas=conta.total_parcelas,
                    data_transacao=transacao_date,
                    tipo="saida",
                    natureza=conta.natureza,
                    forma_pagamento=conta.forma_pagamento,
                    categoria_id=conta.categoria_id,
                    subcategoria_id=conta.subcategoria_id,
                    group_id=str(conta.group_id),
                    conta_recorrente_id=conta.id,
                )
                self.db.add(transacao)
                geradas += 1

            current = current + relativedelta(months=1)

        if geradas > 0:
            await self.db.commit()
        return geradas

    async def renew(self, conta_id: int) -> Optional[ContaRecorrenteORM]:
        """Re‑activate and generate 12 more installments from current month."""
        conta = await self.get_by_id(conta_id)
        if not conta:
            return None

        from dateutil.relativedelta import relativedelta

        # Set as active
        conta.ativo = True

        # Set data_inicio to current month (or next if this month already has a tx)
        now = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        has_current = await self._check_transaction_exists(
            conta.group_id, now.year, now.month
        )
        if has_current:
            new_start = now + relativedelta(months=1)
        else:
            new_start = now
        conta.data_inicio = new_start

        # Generate 12 new installments
        try:
            geradas = await self._generate_installments(conta)
        except Exception as e:
            await self.db.rollback()
            raise HTTPException(status_code=500, detail=f"Erro ao renovar: {e}")

        await self.db.commit()
        await self.db.refresh(conta)
        await self._set_parcelas_restantes(conta)
        return conta

    # ── Helpers ───────────────────────────────────────────

    async def _cancel_future_transactions(self, conta: ContaRecorrenteORM) -> int:
        """Delete all future transactions for this recurring account."""
        now = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        stmt = select(TransacaoORM).where(
            TransacaoORM.conta_recorrente_id == conta.id,
            TransacaoORM.data_transacao >= now,
        )
        result = await self.db.execute(stmt)
        futures = list(result.unique().scalars().all())

        for t in futures:
            await self.db.delete(t)

        count = len(futures)
        if count > 0:
            await self.db.commit()
        return count

    async def _set_parcelas_restantes(self, conta: ContaRecorrenteORM) -> None:
        """Set computed parcelas_restantes on a single conta ORM object."""
        now = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        stmt = select(func.count(TransacaoORM.id)).where(
            TransacaoORM.conta_recorrente_id == conta.id,
            TransacaoORM.data_transacao >= now,
        )
        result = await self.db.execute(stmt)
        conta.parcelas_restantes = result.scalar() or 0

    async def _set_all_parcelas_restantes(self, contas: List[ContaRecorrenteORM]) -> None:
        """Batch-set parcelas_restantes for a list of contas."""
        if not contas:
            return
        ids = [c.id for c in contas]
        now = datetime.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        stmt = select(
            TransacaoORM.conta_recorrente_id,
            func.count(TransacaoORM.id),
        ).where(
            TransacaoORM.conta_recorrente_id.in_(ids),
            TransacaoORM.data_transacao >= now,
        ).group_by(TransacaoORM.conta_recorrente_id)

        result = await self.db.execute(stmt)
        future_map = dict(result.all())

        for c in contas:
            c.parcelas_restantes = future_map.get(c.id, 0)

    # ── Legacy generate (kept for Compatibility) ──────────

    async def generate_pending_transactions(self, req: GenerateRequest) -> tuple[int, list[str]]:
        log = log_database_operation(
            operation="generate",
            collection="contas_recorrentes",
            payload={"data_inicio": str(req.data_inicio), "data_final": str(req.data_final)},
        )

        stmt = select(ContaRecorrenteORM).where(
            ContaRecorrenteORM.ativo == True,
            ContaRecorrenteORM.data_inicio <= req.data_final,
        )
        result = await self.db.execute(stmt)
        contas = list(result.unique().scalars().all())

        geradas = 0
        detalhes = []

        for conta in contas:
            if conta.data_fim and conta.data_fim < req.data_inicio:
                continue

            current_date = req.data_inicio
            while current_date <= req.data_final:
                year = current_date.year
                month = current_date.month

                ultimo_dia = calendar.monthrange(year, month)[1]
                day = min(conta.dia_vencimento, ultimo_dia)
                transacao_date = datetime(year, month, day, 0, 0, 0)

                if transacao_date < req.data_inicio or transacao_date > req.data_final:
                    from dateutil.relativedelta import relativedelta
                    current_date = current_date.replace(day=1) + relativedelta(months=1)
                    continue

                try:
                    already_exists = await self._check_transaction_exists(conta.group_id, year, month)
                except Exception as e:
                    log.error(f"Erro ao verificar transacao existente para {conta.descricao}: {e}")
                    already_exists = True
                    from dateutil.relativedelta import relativedelta
                    current_date = current_date.replace(day=1) + relativedelta(months=1)
                    continue

                if not already_exists:
                    try:
                        transacao = TransacaoORM(
                            valor=conta.valor,
                            descricao=conta.descricao,
                            parcela=1,
                            total_parcelas=1,
                            data_transacao=transacao_date,
                            tipo="saida",
                            natureza=conta.natureza,
                            forma_pagamento=conta.forma_pagamento,
                            categoria_id=conta.categoria_id,
                            subcategoria_id=conta.subcategoria_id,
                            group_id=str(conta.group_id),
                            conta_recorrente_id=conta.id,
                        )
                        self.db.add(transacao)
                        geradas += 1
                        detalhes.append(
                            f"{conta.descricao} - R$ {conta.valor:.2f} em {transacao_date.strftime('%d/%m/%Y')}"
                        )
                    except Exception as e:
                        log.error(f"Erro ao gerar transacao recorrente para {conta.descricao}: {e}")
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

        stmt = select(TransacaoORM.id).where(
            and_(
                TransacaoORM.group_id == gid_str,
                TransacaoORM.data_transacao >= datetime(year, month, 1),
                TransacaoORM.data_transacao < next_month_start,
            )
        )
        try:
            result = await self.db.execute(stmt)
            return result.scalars().first() is not None
        except Exception:
            return False
