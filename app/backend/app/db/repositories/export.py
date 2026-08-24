from datetime import datetime
from typing import List, Optional

from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_session
from app.db.models.transaction import TransactionORM
from app.logger import log_database_operation


class ExportRepository:
    """Acesso a dados para exportação de transações (CSV/OFX)."""

    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db

    async def get_transactions_for_export(
        self, start_date: str, end_date: str
    ) -> List[TransactionORM]:
        """Retorna transações no período com categoria/subcategoria carregadas (selectinload)."""
        log = log_database_operation(
            operation="export", collection="transacoes",
            payload={"start_date": start_date, "end_date": end_date},
        )
        try:
            dt_i = datetime.strptime(start_date, "%d/%m/%Y") if start_date else datetime(2000, 1, 1)
            dt_f = datetime.strptime(end_date, "%d/%m/%Y") if end_date else datetime.now()
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Formato de data inválido. Use DD/MM/YYYY.",
            )

        result = await self.db.execute(
            select(TransactionORM)
            .options(
                selectinload(TransactionORM.category),
                selectinload(TransactionORM.subcategory),
            )
            .where(TransactionORM.transaction_date >= dt_i)
            .where(TransactionORM.transaction_date <= dt_f)
            .order_by(TransactionORM.transaction_date.desc())
        )
        transacoes = list(result.unique().scalars().all())
        log.info(f"{len(transacoes)} transações recuperadas para exportação")
        return transacoes
