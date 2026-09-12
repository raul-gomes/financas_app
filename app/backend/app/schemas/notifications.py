# app/schemas/notifications.py

from pydantic import BaseModel, Field
from typing import List, Optional


class NotificationItem(BaseModel):
    """Alerta de limite pronto para consumo no frontend.

    Frontend usa: severity → cor/badge (warning/critical/destructive),
    message → texto exibido no popover da sine.
    """
    id: int
    category_id: int
    category_name: str
    scope: str  # category | credit_card
    month: str
    threshold: int
    percent_used: float
    exceeded: bool
    created_at: Optional[str] = None
    read: bool
    severity: str = Field(..., description="warning (<90) | critical (90-100) | destructive (>100)")
    message: str = Field(..., description="Mensagem pronta para o frontend exibir")

    @classmethod
    def from_orm(cls, alerta) -> "NotificationItem":
        percent = alerta.percent_used
        if percent > 100:
            severity = "destructive"
        elif percent >= 90:
            severity = "critical"
        else:
            severity = "warning"

        alvo = "Cartão de crédito" if alerta.scope == "credit_card" else f'"{alerta.category_name}"'
        if alerta.exceeded:
            message = f"{alvo} estourou o limite: {percent:.0f}% usado"
        elif percent >= 100:
            message = f"{alvo} atingiu o limite: {percent:.0f}% usado"
        else:
            message = f"{alvo} está em {percent:.0f}% do limite"

        return cls(
            id=alerta.id,
            category_id=alerta.category_id,
            category_name=alerta.category_name or "Categoria",
            scope=alerta.scope,
            month=alerta.month,
            threshold=alerta.threshold,
            percent_used=percent,
            exceeded=alerta.exceeded,
            created_at=alerta.created_at.isoformat() if alerta.created_at else None,
            read=alerta.read_at is not None,
            severity=severity,
            message=message,
        )


class NotificationsResponse(BaseModel):
    """Payload composto para a tela de notificações.

    Uma chamada entregua tudo que a UI precisa (badge + lista) — zero joins no frontend.
    """
    unread_count: int = Field(..., description="Quantidade de não lidas (para o badge da sine)")
    items: List[NotificationItem] = Field(default_factory=list)


class MarkReadResponse(BaseModel):
    success: bool
    updated: int = Field(0, description="Quantidade marcada como lida")


class CategoryRiskResponse(BaseModel):
    """Estado de risco de uma categoria ao criar/editar transação.

    Frontend usa: is_over_limit → aviso não-bloqueante "está estourado o limite".
    """
    category_id: int
    category_name: str
    limit: float
    spent: float
    percent_used: float
    is_over_limit: bool