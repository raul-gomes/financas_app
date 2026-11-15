# app/routes/notifications_routes.py
"""Notifications routes: HTTP concerns only. Rules and authorization live in NotificationService."""

from fastapi import APIRouter, Depends, Path

from app.routes.dependencies import get_notification_reader, get_notification_service
from app.schemas.notifications import MarkReadResponse, NotificationsResponse
from app.services.notification_service import NotificationService

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get(
    "/",
    response_model=NotificationsResponse,
    summary="Listar notificações de limite",
    description="Retorna alertas não resolvidos de limites (categoria e cartão) prontos para a UI: unread_count para o badge + itens com severity e mensagem computados no backend.",
)
async def list_notifications(service: NotificationService = Depends(get_notification_reader)):
    return await service.list_notifications()


@router.put(
    "/{alert_id}/read",
    response_model=MarkReadResponse,
    summary="Marcar notificação como lida",
)
async def mark_alert_read(
    alert_id: int = Path(..., description="ID da notificação"),
    service: NotificationService = Depends(get_notification_service),
):
    return await service.mark_read(alert_id)


@router.put(
    "/read-all",
    response_model=MarkReadResponse,
    summary="Marcar todas como lidas",
)
async def mark_all_read(service: NotificationService = Depends(get_notification_service)):
    return await service.mark_all_read()
