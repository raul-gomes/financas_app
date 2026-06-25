from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from typing import List
from datetime import date, datetime

from app.db.repositories.shopping import ShoppingRepository
from app.schemas.shopping import ShoppingItemCreate, ShoppingItemUpdate, ShoppingItemResponse
from app.logger import log_api_request

router = APIRouter(prefix="/shopping", tags=["Shopping"])


@router.get(
    "/",
    response_model=List[ShoppingItemResponse],
    status_code=status.HTTP_200_OK,
    summary="Listar itens do mês",
    description="Retorna os itens da lista de compras para um determinado mês."
)
async def list_shopping(
    request: Request,
    mes: date = Query(..., description="Mês de referência (YYYY-MM-DD, primeiro dia do mês)"),
    repo: ShoppingRepository = Depends(ShoppingRepository),
):
    log = log_api_request(method="GET", endpoint=str(request.url), mes=str(mes))
    try:
        items = await repo.list_by_month(mes)
        log.info(f"{len(items)} itens encontrados")
        return items
    except Exception as e:
        log.error(f"Erro ao listar itens: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao listar itens"
        )


@router.post(
    "/",
    response_model=ShoppingItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Criar novo item",
    description="Adiciona um item à lista de compras."
)
async def create_shopping_item(
    request: Request,
    payload: ShoppingItemCreate,
    repo: ShoppingRepository = Depends(ShoppingRepository),
):
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    try:
        item = await repo.create(payload)
        log.info(f"Item {item.id} criado")
        return item
    except Exception as e:
        log.error(f"Erro ao criar item: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao criar item"
        )


@router.put(
    "/{item_id}",
    response_model=ShoppingItemResponse,
    summary="Atualizar item",
    description="Atualiza nome e/ou status marcado de um item."
)
async def update_shopping_item(
    request: Request,
    item_id: int,
    payload: ShoppingItemUpdate,
    repo: ShoppingRepository = Depends(ShoppingRepository),
):
    log = log_api_request(method="PUT", endpoint=str(request.url), item_id=item_id)
    try:
        item = await repo.update(item_id, payload)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item não encontrado"
            )
        log.info(f"Item {item_id} atualizado")
        return item
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Erro ao atualizar item {item_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao atualizar item"
        )


@router.delete(
    "/{item_id}",
    response_model=ShoppingItemResponse,
    summary="Excluir item",
    description="Remove um item da lista de compras."
)
async def delete_shopping_item(
    request: Request,
    item_id: int,
    repo: ShoppingRepository = Depends(ShoppingRepository),
):
    log = log_api_request(method="DELETE", endpoint=str(request.url), item_id=item_id)
    try:
        item = await repo.delete(item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item não encontrado"
            )
        log.info(f"Item {item_id} excluído")
        return item
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Erro ao excluir item {item_id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao excluir item"
        )


@router.post(
    "/migrar",
    summary="Migrar itens não-marcados",
    description="Copia itens não-marcados do mês de origem para o mês de destino."
)
async def migrar_itens(
    request: Request,
    mes_origem: date = Query(..., description="Mês de origem (YYYY-MM-DD)"),
    mes_destino: date = Query(..., description="Mês de destino (YYYY-MM-DD)"),
    repo: ShoppingRepository = Depends(ShoppingRepository),
):
    log = log_api_request(
        method="POST",
        endpoint=str(request.url),
        mes_origem=str(mes_origem),
        mes_destino=str(mes_destino),
    )
    try:
        qtd = await repo.migrar_nao_marcados(mes_origem, mes_destino)
        log.info(f"{qtd} itens migrados")
        return {"mensagem": f"{qtd} itens migrados com sucesso", "quantidade": qtd}
    except Exception as e:
        log.error(f"Erro ao migrar itens: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erro interno ao migrar itens"
        )
