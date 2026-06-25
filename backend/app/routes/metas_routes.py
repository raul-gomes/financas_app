from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from typing import List, Optional

from app.db.repositories.meta import MetaRepository
from app.schemas.metas import MetaCreate, MetaUpdate, MetaResponse, MetaProgresso
from app.logger import log_api_request

router = APIRouter(prefix="/metas", tags=["Metas"])


@router.get(
    "/",
    response_model=List[MetaResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar todas as metas",
    description="Retorna todas as subcategorias que possuem valor_alvo (metas)."
)
async def list_metas(
    request: Request,
    concluida: Optional[bool] = Query(None, description="Filtrar por concluída (true=concluídas, false=ativas)"),
    repo: MetaRepository = Depends(MetaRepository),
):
    log = log_api_request(method="GET", endpoint=str(request.url), concluida=concluida)
    try:
        metas = await repo.list_metas(concluida=concluida)
        log.info(f"{len(metas)} metas listadas")
        return metas
    except Exception as e:
        log.error(f"Erro ao listar metas: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao listar metas"
        )


@router.post(
    "/",
    response_model=MetaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar nova meta",
    description="Cria uma nova subcategoria com valor_alvo na categoria 'Metas'."
)
async def create_meta(
    request: Request,
    payload: MetaCreate,
    repo: MetaRepository = Depends(MetaRepository),
):
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    try:
        meta = await repo.create_meta(payload)
        log.info(f"Meta {meta.id} criada")
        return meta
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Erro ao criar meta: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao criar meta"
        )


@router.put(
    "/{meta_id}",
    response_model=MetaResponse,
    summary="Atualizar meta",
    description="Atualiza o nome e/ou valor_alvo de uma meta."
)
async def update_meta(
    request: Request,
    meta_id: int,
    payload: MetaUpdate,
    repo: MetaRepository = Depends(MetaRepository),
):
    log = log_api_request(method="PUT", endpoint=str(request.url), meta_id=meta_id)
    try:
        meta = await repo.update_meta(meta_id, payload)
        if not meta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meta não encontrada"
            )
        log.info(f"Meta {meta_id} atualizada")
        return meta
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Erro ao atualizar meta {meta_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao atualizar meta"
        )


@router.delete(
    "/{meta_id}",
    response_model=MetaResponse,
    summary="Excluir meta",
    description="Remove uma meta (subcategoria)."
)
async def delete_meta(
    request: Request,
    meta_id: int,
    repo: MetaRepository = Depends(MetaRepository),
):
    log = log_api_request(method="DELETE", endpoint=str(request.url), meta_id=meta_id)
    try:
        meta = await repo.delete_meta(meta_id)
        if not meta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meta não encontrada"
            )
        log.info(f"Meta {meta_id} excluída")
        return meta
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Erro ao excluir meta {meta_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao excluir meta"
        )


@router.put(
    "/{meta_id}/concluir",
    response_model=MetaResponse,
    summary="Concluir meta",
    description="Marca uma meta como concluída com a data atual."
)
async def concluir_meta(
    request: Request,
    meta_id: int,
    repo: MetaRepository = Depends(MetaRepository),
):
    log = log_api_request(method="PUT", endpoint=str(request.url), meta_id=meta_id)
    try:
        meta = await repo.concluir_meta(meta_id)
        if not meta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meta não encontrada"
            )
        log.info(f"Meta {meta_id} concluída")
        return meta
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Erro ao concluir meta {meta_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao concluir meta"
        )


@router.put(
    "/{meta_id}/reativar",
    response_model=MetaResponse,
    summary="Reativar meta",
    description="Reativa uma meta que foi concluída."
)
async def reativar_meta(
    request: Request,
    meta_id: int,
    repo: MetaRepository = Depends(MetaRepository),
):
    log = log_api_request(method="PUT", endpoint=str(request.url), meta_id=meta_id)
    try:
        meta = await repo.reativar_meta(meta_id)
        if not meta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meta não encontrada"
            )
        log.info(f"Meta {meta_id} reativada")
        return meta
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Erro ao reativar meta {meta_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao reativar meta"
        )


@router.get(
    "/progresso",
    response_model=List[MetaProgresso],
    summary="Calcular progresso das metas",
    description="Retorna o progresso de todas as metas para um determinado mês/ano."
)
async def calcular_progresso(
    request: Request,
    ano: int = Query(..., description="Ano para calcular progresso"),
    mes: int = Query(..., ge=1, le=12, description="Mês para calcular progresso"),
    concluida: Optional[bool] = Query(None, description="Filtrar por concluída (true=concluídas, false=ativas)"),
    repo: MetaRepository = Depends(MetaRepository),
):
    log = log_api_request(method="GET", endpoint=str(request.url), ano=ano, mes=mes, concluida=concluida)
    try:
        resultados = await repo.calcular_progresso_todas(ano, mes, concluida=concluida)
        log.info(f"Progresso calculado para {len(resultados)} metas")
        return resultados
    except Exception as e:
        log.error(f"Erro ao calcular progresso: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao calcular progresso"
        )
