"""Categories routes: HTTP concerns only. Rules and authorization live in CategoryService."""

from fastapi import APIRouter, Depends, Request, status

from app.logger import log_api_request
from app.routes.dependencies import get_category_reader, get_category_service
from app.schemas.categories import Categoria, CategoriaCreate, CategoriaUpdate
from app.services.category_service import CategoryService

router = APIRouter(prefix="/categories", tags=["Categories"])


@router.get(
    "/",
    response_model=list[Categoria],
    status_code=status.HTTP_200_OK,
    summary="Listar todas as categorias",
    description="Retorna todas as categorias com suas subcategorias.",
)
async def list_categories(
    request: Request,
    service: CategoryService = Depends(get_category_reader),
):
    """
    Obtém a lista completa de categorias.
    """
    log = log_api_request(method="GET", endpoint=str(request.url))
    categorias = await service.list()
    log.info("Categorias listadas com sucesso")
    return categorias


@router.get(
    "/{categoria_id}",
    response_model=Categoria,
    status_code=status.HTTP_200_OK,
    summary="Obter categoria por ID",
    description="Retorna a categoria com o ID informado.",
)
async def get_categoria_by_id(
    request: Request,
    categoria_id: int,
    service: CategoryService = Depends(get_category_reader),
):
    """
    Busca uma categoria pelo seu identificador.
    """
    log = log_api_request(method="GET", endpoint=str(request.url), categoria_id=categoria_id)
    categoria = await service.get(categoria_id)
    log.info(f"Categoria {categoria_id} retornada com sucesso")
    return categoria


@router.post(
    "/",
    response_model=Categoria,
    status_code=status.HTTP_201_CREATED,
    summary="Criar nova categoria",
    description="Cria uma nova categoria com eventuais subcategorias.",
)
async def create_categoria(
    request: Request,
    payload: CategoriaCreate,
    service: CategoryService = Depends(get_category_service),
):
    """
    Cria uma categoria a partir dos dados fornecidos.
    """
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    categoria = await service.create(payload)
    log.info(f"Categoria criada com ID {categoria.id}")
    return categoria


@router.put(
    "/{categoria_id}",
    response_model=Categoria,
    summary="Atualizar categoria",
    description="Atualiza dados de categoria e suas subcategorias.",
)
async def update_categoria(
    request: Request,
    categoria_id: int,
    payload: CategoriaUpdate,
    service: CategoryService = Depends(get_category_service),
):
    """
    Atualiza uma categoria existente e sincroniza subcategorias.
    """
    log = log_api_request(
        method="PUT",
        endpoint=str(request.url),
        categoria_id=categoria_id,
        payload=payload.model_dump(exclude_unset=True),
    )
    categoria = await service.update(categoria_id, payload)
    log.info(f"Categoria {categoria_id} atualizada com sucesso")
    return categoria


@router.delete(
    "/{categoria_id}",
    response_model=Categoria,
    summary="Excluir categoria",
    description="Remove uma categoria pelo seu ID.",
)
async def delete_categoria(
    request: Request,
    categoria_id: int,
    service: CategoryService = Depends(get_category_service),
):
    """
    Deleta uma categoria existente.
    """
    log = log_api_request(method="DELETE", endpoint=str(request.url), categoria_id=categoria_id)
    categoria = await service.delete(categoria_id)
    log.info(f"Categoria {categoria_id} excluída com sucesso")
    return categoria
