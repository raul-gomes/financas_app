from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user, require_admin
from app.db.models.user import UserORM
from app.db.repositories.category import CategoriaRepository
from app.db.repositories.recurring_account import ContaRecorrenteRepository
from app.db.repositories.subcategory import SubcategoriaRepository
from app.logger import log_api_request
from app.schemas.categories import CategoriaCreate
from app.schemas.recurring_account import (
    ContaRecorrenteCreate,
    ContaRecorrenteResponse,
    ContaRecorrenteUpdate,
    GenerateRequest,
    GenerateResponse,
)
from app.schemas.subcategory import SubcategoriaCreate
from app.services.limit_alert_service import trigger_limit_evaluation

router = APIRouter(prefix="/recurring-accounts", tags=["Recurring Accounts"])


async def _resolve_categoria_subcategoria(
    user_id: int,
    payload: Any,
    categoria_repo: CategoriaRepository,
    subcategoria_repo: SubcategoriaRepository,
) -> tuple[int, int]:
    """Resolve category_id and subcategory_id, creating new ones if nome is provided."""
    categoria_id = payload.category_id
    subcategoria_id = payload.subcategory_id

    # Resolve categoria
    if categoria_id is None:
        if not payload.category_name:
            raise HTTPException(status_code=422, detail="category_id or category_name is required")
        existing_cat = await categoria_repo.get_by_nome(payload.category_name, user_id)
        if existing_cat:
            categoria_id = existing_cat.id
        else:
            new_cat = await categoria_repo.create(
                user_id,
                CategoriaCreate(
                    category_name=payload.category_name,
                    entity_type=payload.entity_type,
                    limit=0,
                    type="expense",
                ),
            )
            categoria_id = new_cat.id

    # Resolve subcategoria
    if subcategoria_id is None:
        if not payload.subcategory_name:
            raise HTTPException(
                status_code=422, detail="subcategory_id or subcategory_name is required"
            )
        existing_sub = await subcategoria_repo.get_by_nome_and_categoria(
            payload.subcategory_name, categoria_id, user_id
        )
        if existing_sub:
            subcategoria_id = existing_sub.id
        else:
            new_sub = await subcategoria_repo.create(
                categoria_id,
                user_id,
                SubcategoriaCreate(
                    subcategory_name=payload.subcategory_name,
                ),
            )
            subcategoria_id = new_sub.id

    return categoria_id, subcategoria_id


@router.post("/", response_model=ContaRecorrenteResponse, status_code=status.HTTP_201_CREATED)
async def create_conta_recorrente(
    request: Request,
    payload: ContaRecorrenteCreate,
    current_user: UserORM = Depends(get_current_user),
    repo: ContaRecorrenteRepository = Depends(),
    categoria_repo: CategoriaRepository = Depends(),
    subcategoria_repo: SubcategoriaRepository = Depends(),
):
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    try:
        cat_id, sub_id = await _resolve_categoria_subcategoria(
            current_user.id, payload, categoria_repo, subcategoria_repo
        )
        payload.category_id = cat_id
        payload.subcategory_id = sub_id
        result = await repo.create(payload, current_user.id)
        log.info(f"Conta recorrente {result.id} criada com {result.total_installments} parcelas")
        return result
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        log.error(f"Erro interno ao criar conta recorrente: {e}")
        raise HTTPException(status_code=500, detail="Erro interno") from e


@router.get("/", response_model=list[ContaRecorrenteResponse])
async def list_contas_recorrentes(
    request: Request,
    current_user: UserORM = Depends(get_current_user),
    entity_type: str | None = Query(
        None, description="Filtrar por tipo de entidade: individual, business"
    ),
    limit: int = Query(100, ge=1, le=500, description="Limite de itens por página"),
    offset: int = Query(0, ge=0, description="Offset para paginação"),
    repo: ContaRecorrenteRepository = Depends(),
):
    log = log_api_request(
        method="GET", endpoint=str(request.url), entity_type=entity_type, limit=limit, offset=offset
    )
    try:
        contas = await repo.get_all(
            entity_type=entity_type, limit=limit, offset=offset, user_id=current_user.id
        )
        log.info(f"{len(contas)} contas recorrentes listadas")
        return contas
    except SQLAlchemyError as e:
        log.error(f"Erro ao listar contas recorrentes: {e}")
        raise HTTPException(
            status_code=500, detail="Erro interno ao listar contas recorrentes"
        ) from e


@router.get("/{conta_id}", response_model=ContaRecorrenteResponse)
async def get_conta_recorrente(
    request: Request,
    conta_id: int,
    current_user: UserORM = Depends(get_current_user),
    repo: ContaRecorrenteRepository = Depends(),
):
    log = log_api_request(method="GET", endpoint=str(request.url), conta_id=conta_id)
    conta = await repo.get_by_id(conta_id, current_user.id)
    if not conta:
        log.warning(f"Conta recorrente {conta_id} nao encontrada")
        raise HTTPException(status_code=404, detail="Conta recorrente nao encontrada")
    log.info(f"Conta recorrente {conta_id} retornada")
    return conta


@router.put("/{conta_id}", response_model=ContaRecorrenteResponse)
async def update_conta_recorrente(
    request: Request,
    conta_id: int,
    payload: ContaRecorrenteUpdate,
    current_user: UserORM = Depends(get_current_user),
    repo: ContaRecorrenteRepository = Depends(),
    categoria_repo: CategoriaRepository = Depends(),
    subcategoria_repo: SubcategoriaRepository = Depends(),
):
    log = log_api_request(
        method="PUT",
        endpoint=str(request.url),
        conta_id=conta_id,
        payload=payload.model_dump(exclude_unset=True),
    )
    # Resolve categoria/subcategoria from names if provided
    if payload.category_name or payload.subcategory_name:
        cat_id, sub_id = await _resolve_categoria_subcategoria(
            current_user.id,
            payload,
            categoria_repo,
            subcategoria_repo,  # type: ignore
        )
        payload.category_id = cat_id
        payload.subcategory_id = sub_id
    conta = await repo.update(conta_id, payload, current_user.id)
    if not conta:
        log.warning(f"Conta recorrente {conta_id} nao encontrada")
        raise HTTPException(status_code=404, detail="Conta recorrente nao encontrada")
    log.info(f"Conta recorrente {conta_id} atualizada")
    return conta


@router.delete("/{conta_id}", response_model=ContaRecorrenteResponse)
async def delete_conta_recorrente(
    request: Request,
    conta_id: int,
    current_user: UserORM = Depends(get_current_user),
    repo: ContaRecorrenteRepository = Depends(),
):
    log = log_api_request(method="DELETE", endpoint=str(request.url), conta_id=conta_id)
    try:
        deleted = await repo.delete(conta_id, current_user.id)
        if not deleted:
            log.warning(f"Conta recorrente {conta_id} nao encontrada")
            raise HTTPException(status_code=404, detail="Conta recorrente nao encontrada")
        log.info(f"Conta recorrente {conta_id} excluida")
        return deleted
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        log.error(f"Erro ao excluir conta recorrente {conta_id}: {e}")
        raise HTTPException(
            status_code=500, detail="Erro interno ao excluir conta recorrente"
        ) from e


@router.post("/{conta_id}/renew", response_model=ContaRecorrenteResponse)
async def renew_conta_recorrente(
    request: Request,
    conta_id: int,
    current_user: UserORM = Depends(get_current_user),
    repo: ContaRecorrenteRepository = Depends(),
):
    log = log_api_request(method="POST", endpoint=str(request.url), conta_id=conta_id)
    conta = await repo.renew(conta_id, current_user.id)
    if not conta:
        log.warning(f"Conta recorrente {conta_id} nao encontrada")
        raise HTTPException(status_code=404, detail="Conta recorrente nao encontrada")
    log.info(f"Conta recorrente {conta_id} renovada")
    return conta


@router.post("/generate", response_model=GenerateResponse, dependencies=[Depends(require_admin)])
async def generate_recurrent_transactions(
    request: Request,
    payload: GenerateRequest,
    current_user: UserORM = Depends(get_current_user),
    repo: ContaRecorrenteRepository = Depends(),
    db: AsyncSession = Depends(get_session),
):
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    try:
        geradas, detalhes = await repo.generate_pending_transactions(payload, current_user.id)
        try:
            await trigger_limit_evaluation(
                db, current_user.id, year=payload.start_date.year, month=payload.start_date.month
            )
        except SQLAlchemyError as e:
            log.warning(f"Falha ao avaliar limites pós-recorrentes: {e}")
        log.info(f"{geradas} transacoes recorrentes geradas")
        return GenerateResponse(generated=geradas, details=detalhes)
    except HTTPException:
        raise
    except SQLAlchemyError as e:
        log.error(f"Erro ao gerar transacoes recorrentes: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(
            status_code=500, detail="Erro interno ao gerar transacoes recorrentes"
        ) from e
