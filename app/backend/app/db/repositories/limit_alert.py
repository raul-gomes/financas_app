# app/db/repositories/limit_alert.py

from typing import List, Optional
from datetime import datetime, timezone

from fastapi import Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.database import get_session
from app.db.models.limit_alert import LimitAlertORM
from app.logger import log_database_operation


class LimitAlertRepository:
    """Persistência de alertas de limite (idempotência via unique constraint)."""

    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db

    async def create(
        self,
        user_id: int,
        category_id: int,
        month: str,
        threshold: int,
        exceeded: bool,
        percent_used: float,
        scope: str = "category",
    ) -> LimitAlertORM:
        log = log_database_operation(
            operation="create",
            collection="limit_alerts",
            user_id=user_id,
            category_id=category_id,
            month=month,
            threshold=threshold,
        )
        alerta = LimitAlertORM(
            user_id=user_id,
            category_id=category_id,
            scope=scope,
            month=month,
            threshold=threshold,
            exceeded=exceeded,
            percent_used=round(percent_used, 1),
        )
        self.db.add(alerta)
        await self.db.flush()
        log.info(
            f"Alerta criado: user={user_id} cat={category_id} month={month} threshold={threshold}"
        )
        return alerta

    async def exists(self, user_id: int, category_id: int, month: str, threshold: int) -> bool:
        stmt = (
            select(LimitAlertORM.id)
            .where(
                LimitAlertORM.user_id == user_id,
                LimitAlertORM.category_id == category_id,
                LimitAlertORM.month == month,
                LimitAlertORM.threshold == threshold,
            )
            .limit(1)
        )
        return (await self.db.execute(stmt)).scalar() is not None

    async def list_by_user(self, user_id: int) -> List[LimitAlertORM]:
        stmt = (
            select(LimitAlertORM)
            .where(LimitAlertORM.user_id == user_id)
            .order_by(LimitAlertORM.created_at.desc(), LimitAlertORM.id.desc())
        )
        result = await self.db.execute(stmt)
        return list(result.unique().scalars().all())

    async def unread_count(self, user_id: int) -> int:
        stmt = (
            select(func.count())
            .select_from(LimitAlertORM)
            .where(
                LimitAlertORM.user_id == user_id,
                LimitAlertORM.read_at.is_(None),
            )
        )
        return int((await self.db.execute(stmt)).scalar() or 0)

    async def mark_read(self, alert_id: int, user_id: int) -> Optional[LimitAlertORM]:
        stmt = select(LimitAlertORM).where(
            LimitAlertORM.id == alert_id,
            LimitAlertORM.user_id == user_id,
        )
        alerta = (await self.db.execute(stmt)).scalars().first()
        if alerta:
            alerta.read_at = datetime.now(timezone.utc).replace(tzinfo=None)
        return alerta

    async def mark_all_read(self, user_id: int) -> int:
        alertas = await self.list_by_user(user_id)
        nao_lidos = [a for a in alertas if a.read_at is None]
        for a in nao_lidos:
            a.read_at = datetime.now(timezone.utc).replace(tzinfo=None)
        return len(nao_lidos)

    async def mark_email_sent(self, alert_id: int) -> None:
        stmt = select(LimitAlertORM).where(LimitAlertORM.id == alert_id)
        alerta = (await self.db.execute(stmt)).scalars().first()
        if alerta:
            alerta.email_sent = True
