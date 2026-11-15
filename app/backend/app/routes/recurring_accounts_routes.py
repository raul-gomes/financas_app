"""Recurring-accounts routes: HTTP concerns only. Rules live in RecurringAccountService."""

from fastapi import APIRouter, Depends, Query, Request, status

from app.logger import log_api_request
from app.routes.dependencies import get_recurring_account_reader, get_recurring_account_service
from app.schemas.recurring_account import (
    ContaRecorrenteCreate,
    ContaRecorrenteResponse,
    ContaRecorrenteUpdate,
)
from app.services.recurring_account_service import RecurringAccountService

router = APIRouter(prefix="/recurring-accounts", tags=["Recurring Accounts"])


@router.post("/", response_model=ContaRecorrenteResponse, status_code=status.HTTP_201_CREATED)
async def create_conta_recorrente(
    request: Request,
    payload: ContaRecorrenteCreate,
    service: RecurringAccountService = Depends(get_recurring_account_service),
):
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    result = await service.create(payload)
    log.info(f"Conta recorrente {result.id} criada com {result.total_installments} parcelas")
    return result


@router.get("/", response_model=list[ContaRecorrenteResponse])
async def list_contas_recorrentes(
    request: Request,
    entity_type: str | None = Query(
        None, description="Filtrar por tipo de entidade: individual, business"
    ),
    limit: int = Query(100, ge=1, le=500, description="Limite de itens por página"),
    offset: int = Query(0, ge=0, description="Offset para paginação"),
    service: RecurringAccountService = Depends(get_recurring_account_reader),
):
    log = log_api_request(
        method="GET", endpoint=str(request.url), entity_type=entity_type, limit=limit, offset=offset
    )
    contas = await service.list_accounts(entity_type, limit, offset)
    log.info(f"{len(contas)} contas recorrentes listadas")
    return contas


@router.get("/{conta_id}", response_model=ContaRecorrenteResponse)
async def get_conta_recorrente(
    request: Request,
    conta_id: int,
    service: RecurringAccountService = Depends(get_recurring_account_reader),
):
    log = log_api_request(method="GET", endpoint=str(request.url), conta_id=conta_id)
    conta = await service.get(conta_id)
    log.info(f"Conta recorrente {conta_id} retornada")
    return conta


@router.put("/{conta_id}", response_model=ContaRecorrenteResponse)
async def update_conta_recorrente(
    request: Request,
    conta_id: int,
    payload: ContaRecorrenteUpdate,
    service: RecurringAccountService = Depends(get_recurring_account_service),
):
    log = log_api_request(
        method="PUT",
        endpoint=str(request.url),
        conta_id=conta_id,
        payload=payload.model_dump(exclude_unset=True),
    )
    conta = await service.update(conta_id, payload)
    log.info(f"Conta recorrente {conta_id} atualizada")
    return conta


@router.delete("/{conta_id}", response_model=ContaRecorrenteResponse)
async def delete_conta_recorrente(
    request: Request,
    conta_id: int,
    service: RecurringAccountService = Depends(get_recurring_account_service),
):
    log = log_api_request(method="DELETE", endpoint=str(request.url), conta_id=conta_id)
    deleted = await service.delete(conta_id)
    log.info(f"Conta recorrente {conta_id} excluida")
    return deleted


@router.post("/{conta_id}/renew", response_model=ContaRecorrenteResponse)
async def renew_conta_recorrente(
    request: Request,
    conta_id: int,
    service: RecurringAccountService = Depends(get_recurring_account_service),
):
    log = log_api_request(method="POST", endpoint=str(request.url), conta_id=conta_id)
    conta = await service.renew(conta_id)
    log.info(f"Conta recorrente {conta_id} renovada")
    return conta
