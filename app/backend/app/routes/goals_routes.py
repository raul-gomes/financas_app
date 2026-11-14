"""Goals routes (admin only): HTTP concerns only. Rules and authorization live in GoalService."""

from fastapi import APIRouter, Depends, Query, Request, status

from app.core.security import require_admin
from app.logger import log_api_request
from app.routes.dependencies import get_goal_reader, get_goal_service
from app.schemas.goals import MetaCreate, MetaProgresso, MetaResponse, MetaUpdate
from app.services.goal_service import GoalService

router = APIRouter(prefix="/goals", tags=["Goals"], dependencies=[Depends(require_admin)])


@router.get(
    "/",
    response_model=list[MetaResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar todas as metas",
    description="Retorna todas as subcategorias que possuem valor_alvo (metas).",
)
async def list_metas(
    request: Request,
    completed: bool | None = Query(
        None, description="Filtrar por concluída (true=concluídas, false=ativas)"
    ),
    entity_type: str | None = Query(
        None, description="Filtrar por tipo de entidade: individual, business"
    ),
    limit: int = Query(100, ge=1, le=500, description="Limite de itens por página"),
    offset: int = Query(0, ge=0, description="Offset para paginação"),
    service: GoalService = Depends(get_goal_reader),
):
    log = log_api_request(
        method="GET",
        endpoint=str(request.url),
        completed=completed,
        entity_type=entity_type,
        limit=limit,
        offset=offset,
    )
    metas = await service.list_goals(completed, entity_type, limit, offset)
    log.info(f"{len(metas)} metas listadas")
    return metas


@router.post(
    "/",
    response_model=MetaResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar nova meta",
    description="Cria uma nova subcategoria com valor_alvo na categoria 'Metas'.",
)
async def create_meta(
    request: Request,
    payload: MetaCreate,
    service: GoalService = Depends(get_goal_service),
):
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    meta = await service.create(payload)
    log.info(f"Meta {meta.id} criada")
    return meta


@router.put(
    "/{meta_id}",
    response_model=MetaResponse,
    summary="Atualizar meta",
    description="Atualiza o nome e/ou valor_alvo de uma meta.",
)
async def update_meta(
    request: Request,
    meta_id: int,
    payload: MetaUpdate,
    service: GoalService = Depends(get_goal_service),
):
    log = log_api_request(method="PUT", endpoint=str(request.url), meta_id=meta_id)
    meta = await service.update(meta_id, payload)
    log.info(f"Meta {meta_id} atualizada")
    return meta


@router.delete(
    "/{meta_id}",
    response_model=MetaResponse,
    summary="Excluir meta",
    description="Remove uma meta (subcategoria).",
)
async def delete_meta(
    request: Request,
    meta_id: int,
    service: GoalService = Depends(get_goal_service),
):
    log = log_api_request(method="DELETE", endpoint=str(request.url), meta_id=meta_id)
    meta = await service.delete(meta_id)
    log.info(f"Meta {meta_id} excluída")
    return meta


@router.put(
    "/{goal_id}/complete",
    response_model=MetaResponse,
    summary="Concluir meta",
    description="Marca uma meta como concluída com a data atual.",
)
async def complete_goal(
    request: Request,
    goal_id: int,
    service: GoalService = Depends(get_goal_service),
):
    log = log_api_request(method="PUT", endpoint=str(request.url), goal_id=goal_id)
    meta = await service.complete(goal_id)
    log.info(f"Meta {goal_id} concluída")
    return meta


@router.put(
    "/{goal_id}/reactivate",
    response_model=MetaResponse,
    summary="Reativar meta",
    description="Reativa uma meta que foi concluída.",
)
async def reactivate_goal(
    request: Request,
    goal_id: int,
    service: GoalService = Depends(get_goal_service),
):
    log = log_api_request(method="PUT", endpoint=str(request.url), goal_id=goal_id)
    meta = await service.reactivate(goal_id)
    log.info(f"Meta {goal_id} reativada")
    return meta


@router.get(
    "/progress",
    response_model=list[MetaProgresso],
    summary="Calcular progresso das metas",
    description="Retorna o progresso de todas as metas para um determinado mês/ano.",
)
async def calcular_progresso(
    request: Request,
    year: int = Query(..., alias="year", description="Ano para calcular progresso"),
    month: int = Query(..., alias="month", ge=1, le=12, description="Mês para calcular progresso"),
    completed: bool | None = Query(None, description="Filtrar por status de conclusão"),
    entity_type: str | None = Query(
        None, description="Filtrar por tipo de entidade: individual, business"
    ),
    service: GoalService = Depends(get_goal_reader),
):
    log = log_api_request(
        method="GET",
        endpoint=str(request.url),
        year=year,
        month=month,
        completed=completed,
        entity_type=entity_type,
    )
    resultados = await service.progress(year, month, completed, entity_type)
    log.info(f"Progresso calculado para {len(resultados)} metas")
    return resultados
