"""Pluggy routes (admin only): HTTP concerns only. Rules live in PluggySyncService."""

from fastapi import APIRouter, Depends, Request

from app.core.security import require_admin
from app.logger import log_api_request
from app.routes.dependencies import get_pluggy_reader, get_pluggy_service
from app.services.pluggy_sync_service import PluggySyncService

router = APIRouter(
    prefix="/pluggy", tags=["Pluggy / Open Finance"], dependencies=[Depends(require_admin)]
)


@router.get(
    "/accounts",
    summary="Listar contas do Meu Pluggy",
    description="Retorna as contas conectadas ao Meu Pluggy do usuário.",
)
async def list_pluggy_accounts(
    request: Request,
    service: PluggySyncService = Depends(get_pluggy_reader),
):
    log = log_api_request(method="GET", endpoint=str(request.url))
    result = await service.list_accounts()
    log.info(f"{len(result['accounts'])} contas encontradas")
    return result


@router.post(
    "/sync",
    summary="Sincronizar transações do Meu Pluggy",
    description="Busca todas as transações das contas conectadas e importa para o app.",
)
async def sync_pluggy(
    request: Request,
    service: PluggySyncService = Depends(get_pluggy_service),
):
    log_api_request(method="POST", endpoint=str(request.url))
    return await service.sync()


@router.get(
    "/validate-key",
    summary="Validar API Key do Meu Pluggy",
    description="Verifica se a chave de API do Meu Pluggy é válida.",
)
async def validate_pluggy_key(
    request: Request,
    service: PluggySyncService = Depends(get_pluggy_reader),
):
    log_api_request(method="GET", endpoint=str(request.url))
    return await service.validate_key()
