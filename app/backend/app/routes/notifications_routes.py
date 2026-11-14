# app/routes/notifications_routes.py

from fastapi import APIRouter, Depends, Path
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.db.models.user import UserORM
from app.core.security import get_current_user
from app.db.repositories.limit_alert import LimitAlertRepository
from app.schemas.notifications import (
    NotificationItem,
    NotificationsResponse,
    MarkReadResponse,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "/",
    response_model=NotificationsResponse,
    summary="Listar notificações de limite",
    description="Retorna alertas não resolvidos de limites (categoria e cartão) prontos para a UI: unread_count para o badge + itens com severity e mensagem computados no backend.",
)
async def list_notifications(
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    repo = LimitAlertRepository(db)
    alertas = await repo.list_by_user(current_user.id)
    unread = await repo.unread_count(current_user.id)
    return NotificationsResponse(
        unread_count=unread,
        items=[NotificationItem.from_orm(a) for a in alertas],
    )


@router.put(
    "/{alert_id}/read",
    response_model=MarkReadResponse,
    summary="Marcar notificação como lida",
)
async def mark_alert_read(
    alert_id: int = Path(..., description="ID da notificação"),
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    repo = LimitAlertRepository(db)
    alerta = await repo.mark_read(alert_id, current_user.id)
    if alerta is None:
        return MarkReadResponse(success=False, updated=0)
    await db.commit()
    return MarkReadResponse(success=True, updated=1)


@router.put(
    "/read-all",
    response_model=MarkReadResponse,
    summary="Marcar todas como lidas",
)
async def mark_all_read(
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    repo = LimitAlertRepository(db)
    updated = await repo.mark_all_read(current_user.id)
    await db.commit()
    return MarkReadResponse(success=True, updated=updated)
