# app/services/email_service.py

import os
from typing import Optional

import httpx

from app.logger import logger

RESEND_URL = "https://api.resend.com/emails"


def is_email_enabled() -> bool:
    return os.getenv("EMAIL_ALERTS_ENABLED", "false").lower() == "true"


def _resend_api_key() -> str:
    return os.getenv("RESEND_API_KEY", "")


def _email_from() -> str:
    return os.getenv("EMAIL_FROM", "Placo <onboarding@resend.dev>")


def build_alert_subject(threshold: int, exceeded: bool) -> str:
    if exceeded:
        return f"⚡ Limite estourado! Categoria acima de {threshold}%"
    return f"🔔 Categoria atingiu {threshold}% do limite"


def _fmt_brl(value: float) -> str:
    return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def build_alert_html(
    *,
    category_name: str,
    percent_used: float,
    threshold: int,
    exceeded: bool,
    spent: float = 0.0,
    limit: float = 0.0,
    scope: str = "category",
    month: Optional[str] = None,
) -> str:
    alvo = "Cartão de crédito" if scope == "credit_card" else f'Categoria "{category_name}"'
    if exceeded:
        titulo = "Limite estourado — segure a mão!"
        descricao = (
            f"Seu limite foi ultrapassado: usado {percent_used:.1f}% "
            f"({_fmt_brl(spent)} de {_fmt_brl(limit)})."
        )
    else:
        titulo = f"{alvo} atingiu {threshold}% do limite"
        descricao = (
            f"Você já utilizou {percent_used:.1f}% do limite "
            f"({_fmt_brl(spent)} de {_fmt_brl(limit)})."
        )
    referencia = f"<p>Referência: {month}</p>" if month else ""
    return f"""<html>
<body style="font-family: Arial, sans-serif; background: #f6f7fb; padding: 24px;">
  <div style="max-width: 480px; margin: auto; background: #fff; border-radius: 12px; padding: 24px; border: 1px solid #e5e7eb;">
    <h2 style="margin-top: 0;">{titulo}</h2>
    <p>{descricao}</p>
    {referencia}
    <p style="color:#6b7280; font-size: 12px;">Placo — notificações de limites</p>
  </div>
</body>
</html>"""


async def send_limit_alert_email(
    to_email: str,
    *,
    category_name: str,
    percent_used: float,
    threshold: int,
    exceeded: bool = False,
    spent: float = 0.0,
    limit: float = 0.0,
    scope: str = "category",
    month: Optional[str] = None,
) -> bool:
    """Best-effort: nunca levanta. Retorna True se enviado com sucesso."""
    if not is_email_enabled():
        logger.debug("[email] Notificações de e-mail desabilitadas (EMAIL_ALERTS_ENABLED=false)")
        return False
    if not _resend_api_key():
        logger.warning(
            "[email] EMAIL_ALERTS_ENABLED=true mas RESEND_API_KEY não configurada — pulando envio"
        )
        return False

    html = build_alert_html(
        category_name=category_name,
        percent_used=percent_used,
        threshold=threshold,
        exceeded=exceeded,
        spent=spent,
        limit=limit,
        scope=scope,
        month=month,
    )
    payload = {
        "from": _email_from(),
        "to": [to_email],
        "subject": build_alert_subject(threshold, exceeded),
        "html": html,
    }
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                RESEND_URL,
                headers={"Authorization": f"Bearer {_resend_api_key()}"},
                json=payload,
            )
        if resp.status_code == 200:
            logger.info("[email] Alerta enviado para %s (threshold=%s%%)", to_email, threshold)
            return True
        logger.warning("[email] Resend respondeu %s: %s", resp.status_code, resp.text[:200])
        return False
    except Exception as e:  # noqa: BLE001 — email é best-effort
        logger.error("[email] Falha ao enviar para %s: %s", to_email, e)
        return False
