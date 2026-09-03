from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.core.database import get_session
from app.db.models.user import UserORM
from app.core.security import get_current_user, require_admin
from app.db.repositories.goal import MetaRepository
from app.schemas.goals import MetaCreate, MetaUpdate, MetaResponse, MetaProgresso
from app.logger import log_api_request

router = APIRouter(prefix="/goals", tags=["Goals"],
                   dependencies=[Depends(require_admin)])


@router.get(
    "/",
    response_model=List[MetaResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar todas as metas",
    description="Retorna todas as subcategorias que possuem valor_alvo (metas)."
)
async def list_metas(
    request: Request,
    current_user: UserORM = Depends(get_current_user),
    completed: Optional[bool] = Query(None, description="Filtrar por concluída (true=concluídas, false=ativas)"),
    entity_type: Optional[str] = Query(None, description="Filtrar por tipo de entidade: individual, business"),
    limit: int = Query(100, ge=1, le=500, description="Limite de itens por página"),
    offset: int = Query(0, ge=0, description="Offset para paginação"),
    repo: MetaRepository = Depends(MetaRepository),
):
    log = log_api_request(method="GET", endpoint=str(request.url), completed=completed, entity_type=entity_type, limit=limit, offset=offset)
    try:
        metas = await repo.list_metas(completed=completed, entity_type=entity_type, limit=limit, offset=offset, user_id=current_user.id)
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
    current_user: UserORM = Depends(get_current_user),
    repo: MetaRepository = Depends(MetaRepository),
):
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    try:
        meta = await repo.create_meta(payload, current_user.id)
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
    current_user: UserORM = Depends(get_current_user),
    repo: MetaRepository = Depends(MetaRepository),
):
    log = log_api_request(method="PUT", endpoint=str(request.url), meta_id=meta_id)
    try:
        meta = await repo.update_meta(meta_id, payload, current_user.id)
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
    current_user: UserORM = Depends(get_current_user),
    repo: MetaRepository = Depends(MetaRepository),
):
    log = log_api_request(method="DELETE", endpoint=str(request.url), meta_id=meta_id)
    try:
        meta = await repo.delete_meta(meta_id, current_user.id)
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
    "/{goal_id}/complete",
    response_model=MetaResponse,
    summary="Concluir meta",
    description="Marca uma meta como concluída com a data atual."
)
async def complete_goal(
    request: Request,
    goal_id: int,
    current_user: UserORM = Depends(get_current_user),
    repo: MetaRepository = Depends(MetaRepository),
):
    log = log_api_request(method="PUT", endpoint=str(request.url), goal_id=goal_id)
    try:
        meta = await repo.complete_goal(goal_id, current_user.id)
        if not meta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meta não encontrada"
            )
        log.info(f"Meta {goal_id} concluída")
        return meta
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Erro ao concluir meta {goal_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao concluir meta"
        )


@router.put(
    "/{goal_id}/reactivate",
    response_model=MetaResponse,
    summary="Reativar meta",
    description="Reativa uma meta que foi concluída."
)
async def reactivate_goal(
    request: Request,
    goal_id: int,
    current_user: UserORM = Depends(get_current_user),
    repo: MetaRepository = Depends(MetaRepository),
):
    log = log_api_request(method="PUT", endpoint=str(request.url), goal_id=goal_id)
    try:
        meta = await repo.reactivate_goal(goal_id, current_user.id)
        if not meta:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Meta não encontrada"
            )
        log.info(f"Meta {goal_id} reativada")
        return meta
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Erro ao reativar meta {goal_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao reativar meta"
        )


@router.get(
    "/progress",
    response_model=List[MetaProgresso],
    summary="Calcular progresso das metas",
    description="Retorna o progresso de todas as metas para um determinado mês/ano."
)
async def calcular_progresso(
    request: Request,
    current_user: UserORM = Depends(get_current_user),
    year: int = Query(..., alias="year", description="Ano para calcular progresso"),
    month: int = Query(..., alias="month", ge=1, le=12, description="Mês para calcular progresso"),
    completed: Optional[bool] = Query(None, description="Filtrar por status de conclusão"),
    entity_type: Optional[str] = Query(None, description="Filtrar por tipo de entidade: individual, business"),
    db: AsyncSession = Depends(get_session)
):
    log = log_api_request(method="GET", endpoint=str(request.url), year=year, month=month, completed=completed, entity_type=entity_type)
    repo = MetaRepository(db)
    try:
        resultados = await repo.calcular_progresso_todas(year, month, completed=completed, entity_type=entity_type, user_id=current_user.id)
        log.info(f"Progresso calculado para {len(resultados)} metas")
        return resultados
    except Exception as e:
        log.error(f"Erro ao calcular progresso: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao calcular progresso"
        )
