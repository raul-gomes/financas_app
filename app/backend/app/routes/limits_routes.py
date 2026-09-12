# app/routes/limits.py

from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Dict, Any, Optional

from app.core.database import get_session
from app.db.models.user import UserORM
from app.core.security import get_current_user
from app.db.repositories.limits import LimitsRepository
from app.schemas.limits import LimitsUpdatePayload, LimitsUpdateResponse, LimitsWithSpendingResponse
from app.schemas.notifications import CategoryRiskResponse

router = APIRouter(prefix="/limits", tags=["Limits"])


@router.get(
    "/",
    response_model=List[Dict[str, Any]],
    summary="Listar todas as categorias e limites",
    description="Retorna todas as categorias com subcategorias formatadas para gestão de limites"
)
async def get_all_limits(
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
):
    """
    Endpoint para buscar todas as categorias e subcategorias para gestão de limites.
    """
    limits_repo = LimitsRepository(db)
    return await limits_repo.get_all_limits(current_user.id)


@router.put(
    "/",
    response_model=LimitsUpdateResponse,
    summary="Atualizar limites em lote",
    description="Processa atualizações em lote de categorias e subcategorias, criando novas e atualizando existentes",
    status_code=status.HTTP_200_OK
)
async def update_limits_bulk(
    payload: LimitsUpdatePayload,
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_session)
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
    limits_repo = LimitsRepository(db)
    return await limits_repo.bulk_update_limits(payload, current_user.id)


@router.get(
    "/with-spending",
    response_model=LimitsWithSpendingResponse,
    summary="Listar limites com gastos do mês",
    description="Retorna todas as categorias com limites, gastos realizados, saldo restante e % usado no mês informado"
)
async def get_limits_with_spending(
    current_user: UserORM = Depends(get_current_user),
    year: int = Query(..., description="Ano (ex: 2024)"),
    month: int = Query(..., ge=1, le=12, description="Mês (1-12)"),
    entity_type: Optional[str] = Query(None, description="Filtrar por tipo de entidade: individual, business"),
    db: AsyncSession = Depends(get_session)
):
    """
    Endpoint para buscar limites com gastos reais do período.
    
    Útil para tela de "Limites" mostrar: limite, gasto, restante, % usado.
    """
    limits_repo = LimitsRepository(db)
    return await limits_repo.get_limits_with_spending(year, month, current_user.id, entity_type)


@router.get(
    "/risk-check",
    response_model=CategoryRiskResponse,
    summary="Verificar risco de estouro de uma categoria",
    description="Retorna o estado de risco da categoria para o mês atual, usado no aviso não-bloqueante ao adicionar uma transação em categoria com limite estourado.",
)
async def get_category_risk(
    category_id: int = Query(..., description="ID da categoria a verificar"),
    current_user: UserORM = Depends(get_current_user),
    db: AsyncSession = Depends(get_session),
):
    """
    Endpoint composto: uma chamada retorna se a categoria está estourada e tudo
    que o frontend precisa para exibir o aviso ("está estourado o limite, segure a mão").
    """
    from datetime import datetime

    now = datetime.now()
    limits_repo = LimitsRepository(db)
    data = await limits_repo.get_limits_with_spending(now.year, now.month, current_user.id, None)
    for cat in data["categories"]:
        if cat["id"] == category_id:
            return CategoryRiskResponse(
                category_id=cat["id"],
                category_name=cat["category_name"],
                limit=cat["limit"],
                spent=cat["spent"],
                percent_used=cat["percent_used"],
                is_over_limit=cat["limit"] > 0 and cat["percent_used"] >= 100,
            )
    return CategoryRiskResponse(
        category_id=category_id,
        category_name="Categoria",
        limit=0.0,
        spent=0.0,
        percent_used=0.0,
        is_over_limit=False,
    )