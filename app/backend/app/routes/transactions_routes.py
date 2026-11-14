# app/routes/transactions_routes.py
"""Transactions routes: HTTP concerns only. Rules and authorization live in TransactionService."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status

from app.db.repositories.transaction import TransactionFilters
from app.logger import log_api_request
from app.routes.dependencies import get_transaction_reader, get_transaction_service, parse_date
from app.schemas.transaction import (
    TRANSACTIONS_DEFAULT_PAGE_SIZE,
    TRANSACTIONS_MAX_PAGE_SIZE,
    TRANSACTIONS_SEARCH_MAX_LENGTH,
    DuplicateCheckRequest,
    DuplicateCheckResponse,
    ResolveDuplicatesRequest,
    ResolveDuplicatesResponse,
    TipoTransacao,
    TransacaoCreate,
    TransacaoPageResponse,
    TransacaoResponse,
    TransacaoUpdate,
)
from app.services.transaction_service import TransactionService, single_check_item

LEGACY_LIST_MAX_LIMIT = 500
LEGACY_LIST_DEFAULT_LIMIT = 100

router = APIRouter(prefix="/transacoes", tags=["Transações"])


@router.post(
    "/check-duplicates",
    response_model=DuplicateCheckResponse,
    summary="Verificar duplicatas",
    description="Verifica se já existem transações com a mesma data e valor. Aceita requisição single ou bulk.",
)
async def check_duplicates(
    request: Request,
    payload: DuplicateCheckRequest,
    service: TransactionService = Depends(get_transaction_reader),
):
    log = log_api_request(method="POST", endpoint=str(request.url))

    if payload.transactions is not None:
        items = payload.transactions  # bulk check (including an empty list)
    elif payload.transaction_date is not None and payload.amount is not None:
        items = [single_check_item(payload.transaction_date, payload.amount)]
    else:
        raise HTTPException(
            status_code=400,
            detail="Envie transaction_date+amount para single check, ou transactions[] para bulk.",
        )

    response = await service.check_duplicates(items)
    log.info(f"{len(response.results)} check(s) realizados")
    return response


@router.post(
    "/resolve-duplicates",
    response_model=ResolveDuplicatesResponse,
    summary="Resolver duplicatas",
    description="Aplica as ações escolhidas pelo usuário para resolver duplicatas (keep_both, keep_new, keep_existing).",
)
async def resolve_duplicates(
    request: Request,
    payload: ResolveDuplicatesRequest,
    service: TransactionService = Depends(get_transaction_service),
):
    log = log_api_request(
        method="POST", endpoint=str(request.url), resolutions=len(payload.resolutions)
    )
    response = await service.resolve_duplicates(payload)
    log.info(
        f"Duplicatas resolvidas: {response.resolved} resolvidas, "
        f"{response.deleted} deletadas, {response.kept} mantidas"
    )
    return response


@router.post("/", response_model=TransacaoResponse, status_code=status.HTTP_201_CREATED)
async def create_transacao(
    request: Request,
    payload: TransacaoCreate,
    service: TransactionService = Depends(get_transaction_service),
):
    """
    Cria uma transação. Se categoria/subcategoria não existirem, são criadas.
    """
    log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    return await service.create(payload)


@router.get(
    "/",
    response_model=list[TransacaoResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar transações (legado)",
    description=(
        "Lista transações com filtros de data e limit/offset. Mantido por compatibilidade; "
        "use GET /transacoes/paginated (cursor + total + filtros)."
    ),
)
async def list_transacoes(
    request: Request,
    start_date: str | None = Query(None, description="Data inicial DD/MM/YYYY"),
    end_date: str | None = Query(None, description="Data final DD/MM/YYYY"),
    limit: int = Query(
        LEGACY_LIST_DEFAULT_LIMIT, ge=1, le=LEGACY_LIST_MAX_LIMIT, description="Itens por página"
    ),
    offset: int = Query(0, ge=0, description="Offset para paginação"),
    service: TransactionService = Depends(get_transaction_reader),
):
    """
    Obtém transações entre start_date e end_date, se fornecidas, com paginação.
    """
    dt_i = parse_date(start_date, "start_date") if start_date else None
    dt_f = parse_date(end_date, "end_date") if end_date else None
    log = log_api_request(
        method="GET",
        endpoint=str(request.url),
        start_date=dt_i,
        end_date=dt_f,
        limit=limit,
        offset=offset,
    )
    transacoes = await service.list_legacy(dt_i, dt_f, limit, offset)
    log.info(f"{len(transacoes)} transações listadas")
    return transacoes


@router.get(
    "/paginated",
    response_model=TransacaoPageResponse,
    status_code=status.HTTP_200_OK,
    summary="Listar transações paginadas",
    description=(
        "Página de transações ordenada por data desc e id desc (estável), com cursor opaco, "
        "total e filtros combináveis: período, PF/PJ, tipo, categoria e texto da descrição."
    ),
)
async def list_transacoes_paginated(
    request: Request,
    start_date: str | None = Query(None, description="Data inicial DD/MM/YYYY"),
    end_date: str | None = Query(None, description="Data final DD/MM/YYYY (inclusiva)"),
    entity_type: Literal["individual", "business", "all"] = Query(
        "all", description="PF (individual), PJ (business) ou all"
    ),
    type: TipoTransacao | None = Query(None, description="income, expense ou investment"),
    category_id: int | None = Query(None, ge=1, description="Filtra por categoria"),
    search: str | None = Query(
        None,
        max_length=TRANSACTIONS_SEARCH_MAX_LENGTH,
        description="Texto contido na descrição (sem diferenciar maiúsculas)",
    ),
    limit: int = Query(
        TRANSACTIONS_DEFAULT_PAGE_SIZE,
        ge=1,
        le=TRANSACTIONS_MAX_PAGE_SIZE,
        description="Itens por página",
    ),
    cursor: str | None = Query(None, description="next_cursor da página anterior"),
    service: TransactionService = Depends(get_transaction_reader),
):
    """Uma página do extrato do usuário autenticado (sempre escopada pelo token)."""
    filters = TransactionFilters(
        start_date=parse_date(start_date, "start_date") if start_date else None,
        end_date=parse_date(end_date, "end_date") if end_date else None,
        entity_type=None if entity_type == "all" else entity_type,
        type=type.value if type else None,
        category_id=category_id,
        search=search.strip() if search and search.strip() else None,
    )
    log = log_api_request(
        method="GET", endpoint=str(request.url), limit=limit, has_cursor=cursor is not None
    )
    page = await service.list_page(filters, limit, cursor)
    log.info(f"{len(page.items)} de {page.total} transações")
    return page


@router.get(
    "/{transacao_id}",
    response_model=TransacaoResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter transação por ID",
    description="Retorna detalhes de uma transação específica.",
)
async def get_transacao_by_id(
    request: Request,
    transacao_id: int,
    service: TransactionService = Depends(get_transaction_reader),
):
    """
    Busca transação pelo seu identificador.
    """
    log_api_request(method="GET", endpoint=str(request.url), transacao_id=transacao_id)
    return await service.get(transacao_id)


@router.put(
    "/{transacao_id}",
    response_model=TransacaoResponse,
    summary="Atualizar transação",
)
async def update_transacao(
    request: Request,
    transacao_id: int,
    payload: TransacaoUpdate,
    service: TransactionService = Depends(get_transaction_service),
):
    log_api_request(
        method="PUT",
        endpoint=str(request.url),
        transacao_id=transacao_id,
        payload=payload.model_dump(exclude_unset=True),
    )
    return await service.update(transacao_id, payload)


@router.delete(
    "/{transacao_id}",
    response_model=TransacaoResponse,
    summary="Excluir transação",
    description="Remove uma transação pelo seu ID.",
)
async def delete_transacao(
    request: Request,
    transacao_id: int,
    service: TransactionService = Depends(get_transaction_service),
):
    """
    Exclui uma transação existente.
    """
    log_api_request(method="DELETE", endpoint=str(request.url), transacao_id=transacao_id)
    return await service.delete(transacao_id)
