# app/services/limit_alert_service.py

from typing import List, Optional
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.models.user import UserORM
from app.db.models.transaction import TransactionORM
from app.db.models.limit_alert import LimitAlertORM
from app.db.repositories.limits import LimitsRepository
from app.db.repositories.limit_alert import LimitAlertRepository
from app.services.email_service import send_limit_alert_email
from app.logger import logger

THRESHOLDS = [80, 90, 100]

# Categorias que não geram alerta de limite normal:
#  - "Limite Cartao Credito" → tratado como escopo credit_card (cartão)
#  - "Metas" → são alvos de subcategoria, não limites mensais de gasto
SPECIAL_CATEGORIAS_ALERT = {"limite cartao credito", "metas"}


async def trigger_limit_evaluation(
    db: AsyncSession, user_id: int, year: Optional[int] = None, month: Optional[int] = None
) -> List[LimitAlertORM]:
    """Dispara a avaliação de limites para o mês atual (ou o mês informado).

    Usado pós-mutação (criar/editar/excluir transação, sincronizar extrato/pluggy,
    gerar recorrentes) e pelo job periódico. As proteções do banco tornam
    chamadas repetidas idempotentes.
    """
    now = datetime.now(timezone.utc)
    year = year or now.year
    month = month or now.month
    return await LimitAlertService(db).evaluate_limits(user_id, year, month)


async def evaluate_all_users_current_month(db: AsyncSession) -> int:
    """Job periódico: avalia limites de todos os usuários para o mês atual.

    Retorna o total de alertas NOVOS criados. Idempotente — segura o disparo
    em dobro em múltiplas execuções do job.
    """
    from app.db.models.user import UserORM

    users = (await db.execute(select(UserORM.id))).scalars().all()
    total = 0
    for user_id in users:
        try:
            criados = await trigger_limit_evaluation(db, user_id)
            total += len(criados)
        except Exception as e:  # noqa: BLE001 — job nunca deve derrubar por um usuário
            logger.error(f"[job-limites] Falha ao avaliar user={user_id}: {e}")
    logger.info(f"[job-limites] Avaliação concluída para {len(users)} usuário(s): {total} novo(s)")
    return total


class LimitAlertService:
    """Avalia limites (categorias + cartão) e dispara alertas idempotentes.

    Fonte de verdade dos percentuais: LimitsRepository.get_limits_with_spending
    (mesma query agregada usada no dashboard de limites) — 1 query para tudo.
    """

    def __init__(self, db: AsyncSession):
        self.db = db
        self.repo = LimitAlertRepository(db)
        self.limits_repo = LimitsRepository(db)

    async def evaluate_limits(self, user_id: int, year: int, month: int) -> List[LimitAlertORM]:
        """Retorna os alertas NOVOS criados para o mês (idempotente)."""

        data = await self.limits_repo.get_limits_with_spending(year, month, user_id)
        criados: List[LimitAlertORM] = []

        for cat in data["categories"]:
            limite = cat["limit"] or 0.0
            if limite <= 0:
                continue
            nome = (cat["category_name"] or "").lower()
            if nome in SPECIAL_CATEGORIAS_ALERT:
                continue

            percent = cat["percent_used"]
            for threshold in THRESHOLDS:
                if percent < threshold:
                    break  # thresholds ordenados crescente — se não atinge, atinge menos ainda os maiores
                if await self.repo.exists(user_id, cat["id"], data["month"], threshold):
                    continue
                alerta = await self.repo.create(
                    user_id=user_id,
                    category_id=cat["id"],
                    scope="category",
                    month=data["month"],
                    threshold=threshold,
                    exceeded=percent > 100,
                    percent_used=percent,
                )
                criados.append(alerta)

        criados += await self._evaluate_credit_card(user_id, year, month, data["month"])

        if criados:
            await self.db.commit()
            logger.info(f"{len(criados)} alerta(s) novos para user={user_id} month={data['month']}")

        if criados:
            await self._send_alert_emails(user_id, criados)

        return criados

    async def _send_alert_emails(self, user_id: int, alertas: List[LimitAlertORM]) -> None:
        """Best-effort: envia e-mail por alerta novo (respeita EMAIL_ALERTS_ENABLED)."""
        from app.db.models.category import CategoryORM

        user = (
            (await self.db.execute(select(UserORM).where(UserORM.id == user_id))).scalars().first()
        )
        if not user or not user.email:
            return

        cat_ids = sorted({a.category_id for a in alertas})
        nomes = {}
        if cat_ids:
            cats = (
                (await self.db.execute(select(CategoryORM).where(CategoryORM.id.in_(cat_ids))))
                .unique()
                .scalars()
                .all()
            )
            nomes = {c.id: c.name for c in cats}

        for alerta in alertas:
            await send_limit_alert_email(
                user.email,
                category_name=nomes.get(alerta.category_id, "Categoria"),
                percent_used=alerta.percent_used,
                threshold=alerta.threshold,
                exceeded=alerta.exceeded,
                scope=alerta.scope,
                month=alerta.month,
            )

    async def _evaluate_credit_card(
        self, user_id: int, year: int, month: int, month_str: str
    ) -> List[LimitAlertORM]:
        """Cartão quase no limite; percentual como no dashboard (used = despesas 'credit')."""
        from datetime import datetime

        mes_inicio = datetime(year, month, 1)
        if month == 12:
            mes_fim = datetime(year + 1, 1, 1)
        else:
            mes_fim = datetime(year, month + 1, 1)

        # Limite = soma dos limites das categorias "Limite Cartao Credito"
        from app.db.models.category import CategoryORM

        lim_stmt = select(func.coalesce(func.sum(CategoryORM.limit), 0)).where(
            CategoryORM.user_id == user_id,
            func.lower(CategoryORM.name) == "limite cartao credito",
        )
        limite = float((await self.db.execute(lim_stmt)).scalar() or 0)
        if limite <= 0:
            return []

        # Usado = despesas pagas via crédito no mês (mesma regra do overview)
        used_stmt = select(func.coalesce(func.sum(TransactionORM.amount), 0)).where(
            TransactionORM.user_id == user_id,
            TransactionORM.transaction_date >= mes_inicio,
            TransactionORM.transaction_date < mes_fim,
            TransactionORM.type == "expense",
            TransactionORM.payment_method == "credit",
        )
        used = float((await self.db.execute(used_stmt)).scalar() or 0)
        percent = round((used / limite) * 100, 1)

        criados: List[LimitAlertORM] = []
        for threshold in THRESHOLDS:
            if percent < threshold:
                break
            # Representa o cartão: categoria de limite do cartão (representativa)
            from app.db.models.category import CategoryORM as CO

            card_cat = (
                (
                    await self.db.execute(
                        select(CO)
                        .where(
                            CO.user_id == user_id,
                            func.lower(CO.name) == "limite cartao credito",
                        )
                        .order_by(CO.id)
                        .limit(1)
                    )
                )
                .scalars()
                .first()
            )
            if not card_cat:
                return criados
            if await self.repo.exists(user_id, card_cat.id, month_str, threshold):
                continue
            alerta = await self.repo.create(
                user_id=user_id,
                category_id=card_cat.id,
                scope="credit_card",
                month=month_str,
                threshold=threshold,
                exceeded=percent > 100,
                percent_used=percent,
            )
            criados.append(alerta)
        return criados
