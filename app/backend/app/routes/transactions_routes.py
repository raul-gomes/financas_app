# app/routes/transacoes.py

from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from typing import List, Optional
from datetime import datetime

from app.db.repositories.transaction import TransacaoRepository
from app.db.models.user import UserORM
from app.core.security import get_current_user
from app.schemas.transaction import (
    TransacaoCreate, TransacaoResponse, TransacaoUpdate,
    DuplicateCheckRequest, DuplicateCheckResponse, SingleDuplicateCheckResult, DuplicateInfo,
    DuplicateResolution, ResolveDuplicatesRequest, ResolveDuplicatesResponse,
)
from app.logger import log_api_request

def parse_date(date_str: str, field_name: str) -> datetime:
    try:
        return datetime.strptime(date_str, "%d/%m/%Y")
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Formato inválido para {field_name}. Use DD/MM/YYYY.")

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
    current_user: UserORM = Depends(get_current_user),
    repo: TransacaoRepository = Depends(),
):
    log = log_api_request(method="POST", endpoint=str(request.url))
    results = []

    if payload.transactions is not None:
        # Bulk check (including empty list)
        for item in payload.transactions:
            duplicates = await repo.check_duplicates(item.transaction_date, item.amount, current_user.id)
            dup_info = [
                DuplicateInfo(
                    id=t.id,
                    description=t.description,
                    amount=t.amount,
                    transaction_date=t.transaction_date,
                    type=t.type,
                    entity_type=t.entity_type,
                    category_name=t.category.name if t.category else None,
                    subcategory_name=t.subcategory.name if t.subcategory else None,
                    payment_method=t.payment_method,
                    created_at=t.created_at,
                )
                for t in duplicates
            ]
            results.append(SingleDuplicateCheckResult(
                index=item.index,
                has_duplicate=len(dup_info) > 0,
                duplicates=dup_info,
            ))
    elif payload.transaction_date is not None and payload.amount is not None:
        # Single check
        duplicates = await repo.check_duplicates(payload.transaction_date, payload.amount, current_user.id)
        dup_info = [
            DuplicateInfo(
                id=t.id,
                description=t.description,
                amount=t.amount,
                transaction_date=t.transaction_date,
                type=t.type,
                entity_type=t.entity_type,
                category_name=t.category.name if t.category else None,
                subcategory_name=t.subcategory.name if t.subcategory else None,
                payment_method=t.payment_method,
                created_at=t.created_at,
            )
            for t in duplicates
        ]
        results.append(SingleDuplicateCheckResult(
            index=0,
            has_duplicate=len(dup_info) > 0,
            duplicates=dup_info,
        ))
    else:
        raise HTTPException(
            status_code=400,
            detail="Envie transaction_date+amount para single check, ou transactions[] para bulk."
        )

    log.info(f"{len(results)} check(s) realizados")
    return DuplicateCheckResponse(results=results)


# ── old single-check block removed (now handled above) ──


@router.post(
    "/resolve-duplicates",
    response_model=ResolveDuplicatesResponse,
    summary="Resolver duplicatas",
    description="Aplica as ações escolhidas pelo usuário para resolver duplicatas (keep_both, keep_new, keep_existing).",
)
async def resolve_duplicates(
    request: Request,
    payload: ResolveDuplicatesRequest,
    current_user: UserORM = Depends(get_current_user),
    repo: TransacaoRepository = Depends(),
):
    log = log_api_request(method="POST", endpoint=str(request.url), resolutions=len(payload.resolutions))
    resolved = 0
    deleted = 0
    kept = 0

    for res in payload.resolutions:
        existing = await repo.get_by_id(res.existing_id, current_user.id)
        new_t = await repo.get_by_id(res.new_id, current_user.id)

        if res.action == "keep_both":
            kept += 1
            resolved += 1
        elif res.action == "keep_new":
            resolved += 1
            if existing:
                await repo.delete(existing.id, current_user.id)
                deleted += 1
        elif res.action == "keep_existing":
            resolved += 1
            if new_t:
                await repo.delete(new_t.id, current_user.id)
                deleted += 1

    log.info(f"Duplicatas resolvidas: {resolved} resolvidas, {deleted} deletadas, {kept} mantidas")
    return ResolveDuplicatesResponse(resolved=resolved, deleted=deleted, kept=kept)


@router.post("/", response_model=TransacaoResponse, status_code=status.HTTP_201_CREATED)
async def create_transacao(
    request: Request,
    payload: TransacaoCreate,
    current_user: UserORM = Depends(get_current_user),
    status_code=status.HTTP_201_CREATED,
    repo: TransacaoRepository = Depends()
):
    """
    Cria uma transação. Se categoria/subcategoria não existirem, são criadas.
    """
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    try:
        return await repo.create(payload, current_user.id)
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Erro interno ao criar transação: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno: {str(e)}")



@router.get(
    "/",
    response_model=List[TransacaoResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar transações",
    description="Lista todas as transações, com filtros opcionais por data e paginação."
)
async def list_transacoes(
    request: Request,
    current_user: UserORM = Depends(get_current_user),
    start_date: Optional[str] = Query(None, description="Data inicial DD/MM/YYYY"),
    end_date: Optional[str] = Query(None, description="Data final DD/MM/YYYY"),
    limit: int = Query(100, ge=1, le=500, description="Limite de itens por página"),
    offset: int = Query(0, ge=0, description="Offset para paginação"),
    repo: TransacaoRepository = Depends(TransacaoRepository)
):
    """
    Obtém transações entre start_date e end_date, se fornecidas, com paginação.
    """
    dt_i = parse_date(start_date, "start_date") if start_date else None
    dt_f = parse_date(end_date, "end_date") if end_date else None

    if dt_f:
        dt_f = datetime.combine(dt_f.date(), datetime.max.time())

    log = log_api_request(
        method="GET",
        endpoint=str(request.url),
        start_date=dt_i,
        end_date=dt_f,
        limit=limit,
        offset=offset
    )
    try:
        transacoes = await repo.get_all(dt_i, dt_f, limit=limit, offset=offset, user_id=current_user.id)
        log.info(f"{len(transacoes)} transações listadas")
        return transacoes
    except Exception as e:
        log.error(f"Erro ao listar transações: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao listar transações"
        )


@router.get(
    "/{transacao_id}",
    response_model=TransacaoResponse,
    status_code=status.HTTP_200_OK,
    summary="Obter transação por ID",
    description="Retorna detalhes de uma transação específica."
)
async def get_transacao_by_id(
    request: Request,
    transacao_id: int,
    current_user: UserORM = Depends(get_current_user),
    repo: TransacaoRepository = Depends(TransacaoRepository)
):
    """
    Busca transação pelo seu identificador.
    """
    log = log_api_request(method="GET", endpoint=str(request.url), transacao_id=transacao_id)
    trans = await repo.get_by_id(transacao_id, current_user.id)
    if not trans:
        log.warning(f"Transação {transacao_id} não encontrada")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Transação não encontrada"
        )
    log.info(f"Transação {transacao_id} retornada")
    return trans


@router.put(
    "/{transacao_id}",
    response_model=TransacaoResponse,
    summary="Atualizar transação",
)
async def update_transacao(
    request: Request,
    transacao_id: int,
    payload: TransacaoUpdate,
    current_user: UserORM = Depends(get_current_user),
    repo: TransacaoRepository = Depends(TransacaoRepository)
):
    log = log_api_request(method="PUT", endpoint=str(request.url), transacao_id=transacao_id, payload=payload.dict(exclude_unset=True))
    trans = await repo.update(transacao_id, payload, current_user.id)
    if not trans:
        log.warning(f"Transação {transacao_id} não encontrada")
        raise HTTPException(status_code=404, detail="Transação não encontrada")
    log.info(f"Transação {transacao_id} atualizada")
    return trans



@router.delete(
    "/{transacao_id}",
    response_model=TransacaoResponse,
    summary="Excluir transação",
    description="Remove uma transação pelo seu ID."
)
async def delete_transacao(
    request: Request,
    transacao_id: int,
    current_user: UserORM = Depends(get_current_user),
    repo: TransacaoRepository = Depends(TransacaoRepository)
):
    """
    Exclui uma transação existente.
    """
    log = log_api_request(method="DELETE", endpoint=str(request.url), transacao_id=transacao_id)
    try:
        deleted = await repo.delete(transacao_id, current_user.id)
        if not deleted:
            log.warning(f"Tentativa de excluir transação {transacao_id} não encontrada")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transação não encontrada"
            )
        log.info(f"Transação {transacao_id} excluída")
        return deleted
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Erro ao excluir transação {transacao_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao excluir transação"
        )
