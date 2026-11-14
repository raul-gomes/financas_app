# app/routes/limits.py

from typing import Any

from fastapi import APIRouter, Depends, Query, status

from app.routes.dependencies import get_limits_reader, get_limits_service
from app.schemas.limits import LimitsUpdatePayload, LimitsUpdateResponse, LimitsWithSpendingResponse
from app.schemas.notifications import CategoryRiskResponse
from app.services.limits_service import LimitsService

router = APIRouter(prefix="/limits", tags=["Limits"])


@router.get(
    "/",
    response_model=list[dict[str, Any]],
    summary="Listar todas as categorias e limites",
    description="Retorna todas as categorias com subcategorias formatadas para gestão de limites",
)
async def get_all_limits(service: LimitsService = Depends(get_limits_reader)):
    """
    Endpoint para buscar todas as categorias e subcategorias para gestão de limites.
    """
    return await service.list_all()


@router.put(
    "/",
    response_model=LimitsUpdateResponse,
    summary="Atualizar limites em lote",
    description="Processa atualizações em lote de categorias e subcategorias, criando novas e atualizando existentes",
    status_code=status.HTTP_200_OK,
)
async def update_limits_bulk(
    payload: LimitsUpdatePayload,
    service: LimitsService = Depends(get_limits_service),
):
    """
    Endpoint para atualização em lote de limites.

    Processa duas listas:
    - `new`: Categorias novas (sem ID) que serão criadas
    - `modified`: Categorias existentes (com ID) que serão atualizadas

    Exemplo de payload:
    ```json
    {
        "new": [
            {
                "category_name": "Nova Categoria",
                "entity_type": "individual",
                "limit": 1000,
                "subcategories": [
                    {"subcategory_name": "Nova Sub"}
                ]
            }
        ],
        "modified": [
            {
                "id": 2,
                "category_name": "Categoria Modificada",
                "entity_type": "individual",
                "limit": 1500,
                "subcategories": [
                    {"id": 3, "subcategory_name": "Sub Existente"},
                    {"subcategory_name": "Sub Nova"}
                ]
            }
        ]
    }
    ```
    """
    return await service.bulk_update(payload)


@router.get(
    "/with-spending",
    response_model=LimitsWithSpendingResponse,
    summary="Listar limites com gastos do mês",
    description="Retorna todas as categorias com limites, gastos realizados, saldo restante e % usado no mês informado",
)
async def get_limits_with_spending(
    year: int = Query(..., description="Ano (ex: 2024)"),
    month: int = Query(..., ge=1, le=12, description="Mês (1-12)"),
    entity_type: str | None = Query(
        None, description="Filtrar por tipo de entidade: individual, business"
    ),
    service: LimitsService = Depends(get_limits_reader),
):
    """
    Endpoint para buscar limites com gastos reais do período.

    Útil para tela de "Limites" mostrar: limite, gasto, restante, % usado.
    """
    return await service.with_spending(year, month, entity_type)


@router.get(
    "/risk-check",
    response_model=CategoryRiskResponse,
    summary="Verificar risco de estouro de uma categoria",
    description="Retorna o estado de risco da categoria para o mês atual, projetando o valor digitado (gasto atual + amount). Aviso não-bloqueante ao adicionar uma transação em categoria com limite próximo/estourado.",
)
async def get_category_risk(
    category_id: int = Query(..., description="ID da categoria a verificar"),
    amount: float | None = Query(0.0, description="Valor da transação digitado (projeção)"),
    service: LimitsService = Depends(get_limits_reader),
):
    """
    Endpoint composto: uma chamada retorna a % atual, a % projetada (gasto +
    valor digitado), os thresholds 80/90/100 atingidos e a severidade — o front
    só renderiza as cores/mensagens ("segure a mão" / "está estourado").
    """
    return await service.category_risk(category_id, amount)
