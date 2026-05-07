from typing import List, Optional
from datetime import datetime
from uuid import uuid4

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
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

    async def create(self, obj_in: ContaRecorrenteCreate) -> ContaRecorrenteORM:
        log = log_database_operation(operation="create", collection="contas_recorrentes", payload=obj_in.model_dump())
        inst = ContaRecorrenteORM(
            descricao=obj_in.descricao,
            valor=obj_in.valor,
            dia_vencimento=obj_in.dia_vencimento,
            categoria_id=obj_in.categoria_id,
            subcategoria_id=obj_in.subcategoria_id,
            natureza=obj_in.natureza,
            forma_pagamento=obj_in.forma_pagamento,
            data_inicio=obj_in.data_inicio,
            data_fim=obj_in.data_fim,
            ativo=obj_in.ativo,
            group_id=str(uuid4()),
        )
        self.db.add(inst)
        try:
            await self.db.commit()
            await self.db.refresh(inst)
            log.info(f"Conta recorrente {inst.id} criada")
            return inst
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Erro ao criar conta recorrente")

    async def get_all(self) -> List[ContaRecorrenteORM]:
        stmt = select(ContaRecorrenteORM).options(
            selectinload(ContaRecorrenteORM.categoria),
            selectinload(ContaRecorrenteORM.subcategoria),
        ).order_by(ContaRecorrenteORM.data_inicio.desc())
        result = await self.db.execute(stmt)
        return list(result.unique().scalars().all())

    async def get_by_id(self, id: int) -> Optional[ContaRecorrenteORM]:
        stmt = select(ContaRecorrenteORM).options(
            selectinload(ContaRecorrenteORM.categoria),
            selectinload(ContaRecorrenteORM.subcategoria),
        ).where(ContaRecorrenteORM.id == id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def update(self, id: int, obj_in: ContaRecorrenteUpdate) -> Optional[ContaRecorrenteORM]:
        conta = await self.get_by_id(id)
        if not conta:
            return None

        data = obj_in.model_dump(exclude_unset=True)
        for field, val in data.items():
            setattr(conta, field, val)

        try:
            await self.db.commit()
            await self.db.refresh(conta)
            return conta
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Erro ao atualizar conta recorrente")

    async def delete(self, id: int) -> Optional[ContaRecorrenteORM]:
        conta = await self.get_by_id(id)
        if not conta:
            return None
        await self.db.delete(conta)
        await self.db.commit()
        return conta

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

                day = min(conta.dia_vencimento, 28)

                transacao_date = datetime(year, month, day, 0, 0, 0)

                if transacao_date < req.data_inicio or transacao_date > req.data_final:
                    current_date = current_date.replace(day=1)
                    from dateutil.relativedelta import relativedelta
                    current_date = current_date + relativedelta(months=1)
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
