# app/routes/transacoes.py

from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from typing import List, Optional
from datetime import datetime

from app.db.repositories.transacao import TransacaoRepository
from app.schemas.transacao import (
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
    repo: TransacaoRepository = Depends(),
):
    log = log_api_request(method="POST", endpoint=str(request.url))
    results = []

    if payload.transacoes is not None:
        # Bulk check (including empty list)
        for item in payload.transacoes:
            duplicates = await repo.check_duplicates(item.data_transacao, item.valor)
            dup_info = [
                DuplicateInfo(
                    id=t.id,
                    descricao=t.descricao,
                    valor=t.valor,
                    data_transacao=t.data_transacao,
                    tipo=t.tipo,
                    natureza=t.natureza,
                    categoria_nome=t.categoria.categoria_nome if t.categoria else None,
                    subcategoria_nome=t.subcategoria.subcategoria_nome if t.subcategoria else None,
                    forma_pagamento=t.forma_pagamento,
                    data_criacao=t.data_criacao,
                )
                for t in duplicates
            ]
            results.append(SingleDuplicateCheckResult(
                index=item.index,
                has_duplicate=len(dup_info) > 0,
                duplicates=dup_info,
            ))
    elif payload.data_transacao is not None and payload.valor is not None:
        # Single check
        duplicates = await repo.check_duplicates(payload.data_transacao, payload.valor)
        dup_info = [
            DuplicateInfo(
                id=t.id,
                descricao=t.descricao,
                valor=t.valor,
                data_transacao=t.data_transacao,
                tipo=t.tipo,
                natureza=t.natureza,
                categoria_nome=t.categoria.categoria_nome if t.categoria else None,
                subcategoria_nome=t.subcategoria.subcategoria_nome if t.subcategoria else None,
                forma_pagamento=t.forma_pagamento,
                data_criacao=t.data_criacao,
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
            detail="Envie data_transacao+valor para single check, ou transacoes[] para bulk."
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
    repo: TransacaoRepository = Depends(),
):
    log = log_api_request(method="POST", endpoint=str(request.url), resolutions=len(payload.resolutions))
    resolved = 0
    deleted = 0
    kept = 0

    for res in payload.resolutions:
        existing = await repo.get_by_id(res.existing_id)
        new_t = await repo.get_by_id(res.new_id)

        if res.action == "keep_both":
            kept += 1
            resolved += 1
        elif res.action == "keep_new":
            resolved += 1
            if existing:
                await repo.delete(existing.id)
                deleted += 1
        elif res.action == "keep_existing":
            resolved += 1
            if new_t:
                await repo.delete(new_t.id)
                deleted += 1

    log.info(f"Duplicatas resolvidas: {resolved} resolvidas, {deleted} deletadas, {kept} mantidas")
    return ResolveDuplicatesResponse(resolved=resolved, deleted=deleted, kept=kept)


@router.post("/", response_model=TransacaoResponse, status_code=status.HTTP_201_CREATED)
async def create_transacao(
    request: Request,
    payload: TransacaoCreate,
    status_code=status.HTTP_201_CREATED,
    repo: TransacaoRepository = Depends()
):
    """
    Cria uma transação. Se categoria/subcategoria não existirem, são criadas.
    """
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    try:
        return await repo.create(payload)
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
    description="Lista todas as transações, com filtros opcionais por data."
)
async def list_transacoes(
    request: Request,
    data_inicio: Optional[str] = Query(None, description="Data inicial DD/MM/YYYY"),
    data_final: Optional[str] = Query(None, description="Data final DD/MM/YYYY"),
    repo: TransacaoRepository = Depends(TransacaoRepository)
):
    """
    Obtém transações entre data_inicio e data_final, se fornecidas.
    """
    dt_i = parse_date(data_inicio, "data_inicio") if data_inicio else None
    dt_f = parse_date(data_final, "data_final") if data_final else None

    if dt_f:
        dt_f = datetime.combine(dt_f.date(), datetime.max.time())

    log = log_api_request(
        method="GET",
        endpoint=str(request.url),
        data_inicio=dt_i,
        data_final=dt_f
    )
    try:
        transacoes = await repo.get_all(dt_i, dt_f)
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
    repo: TransacaoRepository = Depends(TransacaoRepository)
):
    """
    Busca transação pelo seu identificador.
    """
    log = log_api_request(method="GET", endpoint=str(request.url), transacao_id=transacao_id)
    trans = await repo.get_by_id(transacao_id)
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
    repo: TransacaoRepository = Depends(TransacaoRepository)
):
    log = log_api_request(method="PUT", endpoint=str(request.url), transacao_id=transacao_id, payload=payload.dict(exclude_unset=True))
    trans = await repo.update(transacao_id, payload)
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
    repo: TransacaoRepository = Depends(TransacaoRepository)
):
    """
    Exclui uma transação existente.
    """
    log = log_api_request(method="DELETE", endpoint=str(request.url), transacao_id=transacao_id)
    try:
        deleted = await repo.delete(transacao_id)
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
