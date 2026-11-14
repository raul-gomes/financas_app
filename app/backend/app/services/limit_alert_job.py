# app/services/limit_alert_job.py

import asyncio
from contextlib import suppress

from sqlalchemy.exc import SQLAlchemyError

from app.core.advisory_lock import LIMIT_ALERT_JOB_LOCK_KEY, try_advisory_lock
from app.core.config import Config
from app.core.database import AsyncSessionLocal, engine
from app.logger import logger
from app.services.limit_alert_service import evaluate_all_users_current_month


async def run_evaluation_once() -> int:
    """Uma rodada do job: avalia limites de todos os usuários para o mês atual.

    Separado do loop para ser testável de forma isolada (Etapa 6). Com mais de uma
    réplica, só uma roda por vez: quem não obtém o advisory lock pula a rodada.
    """
    async with try_advisory_lock(engine, LIMIT_ALERT_JOB_LOCK_KEY) as acquired:
        if not acquired:
            logger.info("[job-limites] Outra réplica está avaliando; rodada ignorada")
            return 0
        async with AsyncSessionLocal() as session:
            try:
                return await evaluate_all_users_current_month(session)
            except SQLAlchemyError as e:
                logger.error(f"[job-limites] Erro na rodada: {e}")
                return 0
            finally:
                await session.rollback()


async def _job_loop(interval: int) -> None:
    logger.info(f"[job-limites] Job periódico iniciado (intervalo={interval}s)")
    while True:
        await run_evaluation_once()
        await asyncio.sleep(interval)


async def start_limit_alert_job() -> asyncio.Task:
    """Inicia o job em background; retorna a task para cancelamento no shutdown."""
    return asyncio.get_running_loop().create_task(
        _job_loop(Config.ALERT_CHECK_INTERVAL),
        name="limit-alert-job",
    )


async def stop_limit_alert_job(task: asyncio.Task | None) -> None:
    if task is None:
        return
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task
