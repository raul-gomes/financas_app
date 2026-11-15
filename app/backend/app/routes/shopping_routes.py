"""Shopping routes (admin only): HTTP concerns only. Rules live in ShoppingService."""

from datetime import date

from fastapi import APIRouter, Depends, Query, Request, status

from app.core.security import require_admin
from app.logger import log_api_request
from app.routes.dependencies import get_shopping_reader, get_shopping_service
from app.schemas.shopping import (
    GenerateRecurringShoppingRequest,
    ShoppingItemCreate,
    ShoppingItemResponse,
    ShoppingItemUpdate,
)
from app.services.shopping_service import ShoppingService

router = APIRouter(prefix="/shopping", tags=["Shopping"], dependencies=[Depends(require_admin)])


@router.get(
    "/",
    response_model=list[ShoppingItemResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar itens do mês",
    description="Retorna os itens da lista de compras para um determinado mês.",
)
async def list_shopping(
    request: Request,
    month: date = Query(..., description="Mês de referência (YYYY-MM-DD, primeiro dia do mês)"),
    entity_type: str | None = Query(
        None, description="Filtrar por tipo de entidade: individual, business"
    ),
    service: ShoppingService = Depends(get_shopping_reader),
):
    log = log_api_request(
        method="GET", endpoint=str(request.url), month=str(month), entity_type=entity_type
    )
    items = await service.list_month(month, entity_type)
    log.info(f"{len(items)} itens encontrados")
    return items


@router.post(
    "/",
    response_model=ShoppingItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar novo item",
    description="Adiciona um item à lista de compras.",
)
async def create_shopping_item(
    request: Request,
    payload: ShoppingItemCreate,
    service: ShoppingService = Depends(get_shopping_service),
):
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    item = await service.create(payload)
    log.info(f"Item {item.id} criado")
    return item


@router.put(
    "/{item_id}",
    response_model=ShoppingItemResponse,
    summary="Atualizar item",
    description="Atualiza nome e/ou status marcado de um item.",
)
async def update_shopping_item(
    request: Request,
    item_id: int,
    payload: ShoppingItemUpdate,
    service: ShoppingService = Depends(get_shopping_service),
):
    log = log_api_request(method="PUT", endpoint=str(request.url), item_id=item_id)
    item = await service.update(item_id, payload)
    log.info(f"Item {item_id} atualizado")
    return item


@router.delete(
    "/{item_id}",
    response_model=ShoppingItemResponse,
    summary="Excluir item",
    description="Remove um item da lista de compras.",
)
async def delete_shopping_item(
    request: Request,
    item_id: int,
    service: ShoppingService = Depends(get_shopping_service),
):
    log = log_api_request(method="DELETE", endpoint=str(request.url), item_id=item_id)
    item = await service.delete(item_id)
    log.info(f"Item {item_id} excluído")
    return item


@router.post(
    "/generate-recurring",
    summary="Gerar itens recorrentes de compras",
    description="Cria cópias de itens marcados como recorrentes para os meses subsequentes.",
)
async def generate_recurring_shopping(
    request: Request,
    payload: GenerateRecurringShoppingRequest,
    service: ShoppingService = Depends(get_shopping_service),
):
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    gerados = await service.generate_recurring(payload)
    log.info(f"{gerados} itens recorrentes de compras gerados")
    return {"generated": gerados, "message": f"{gerados} itens recorrentes gerados"}
