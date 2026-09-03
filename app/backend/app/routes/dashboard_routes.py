import calendar
from fastapi import APIRouter, Query, Depends, HTTPException, status
from typing import Any, Dict, Literal, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.db.models.user import UserORM
from app.core.security import get_current_user

from app.db.repositories.dashboard import DashboardRepository
from app.schemas.dashboard import EntradasPorCategoriaResponse, ExtratoResponse, GastosPorCategoriaResponse, OpcoesCategoriaResponse, RendimentoPeriodoResponse, TipoTrans

from app.logger import log_api_request



router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def parse_date(date_str: str, field_name: str) -> datetime:
    try:
        return datetime.strptime(date_str, "%d/%m/%Y")
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Formato inválido para {field_name}. Use DD/MM/YYYY.")

@router.get(
    "/statement",
    response_model=ExtratoResponse,
    summary="Extrato financeiro completo",
    description="Retorna entradas, saídas, meta e lista de transações no período",
    status_code=status.HTTP_200_OK
)
async def extrato_financeiro(
    current_user: UserORM = Depends(get_current_user),
    start_date: str = Query(..., description="Data inicial DD/MM/YYYY"),
    end_date: str = Query(..., description="Data final DD/MM/YYYY"),
    entity_type: str = Query(default='individual', description="Entity type: individual, business ou all"),
    db: AsyncSession = Depends(get_session)
):
    api_logger = log_api_request("GET", "/dashboard/statement")

    dt_i = parse_date(start_date, "start_date")
    dt_f = parse_date(end_date, "end_date")
    dt_f = datetime.combine(dt_f.date(), datetime.max.time())

    dashboard_repo = DashboardRepository(db)
    extrato = await dashboard_repo.extrato_financeiro(dt_i, dt_f, entity_type, start_date, end_date, current_user.id)

    api_logger.success(
        "Extrato gerado", 
        total_income=extrato.total_income, 
        total_expenses=extrato.total_expenses, 
        count=len(extrato.transactions)
    )

    return extrato



@router.get(
    "/period-income",
    response_model=RendimentoPeriodoResponse,
    summary="Rendimento por período",
    description="Retorna entradas/saídas agregadas por mês no ano"
)
async def rendimento_periodo(
    current_user: UserORM = Depends(get_current_user),
    year: int = Query(..., description="Ano para agregação (YYYY)"),
    entity_type: str = Query(default='individual', description="Entity type: individual, business ou all"),
    db: AsyncSession = Depends(get_session)
):
    api_logger = log_api_request("GET", "/dashboard/period-income")

    dashboard_repo = DashboardRepository(db)
    rendimento_ano = await dashboard_repo.rendimento_por_periodo(year, entity_type, current_user.id)

    api_logger.success("Rendimento por período gerado", year=year)

    return rendimento_ano

@router.get(
    "/expenses-by-category",
    response_model=GastosPorCategoriaResponse,
    summary="Gastos por categoria/subcategoria",
    description="Retorna valores agregados por categoria e subcategoria para 'income' ou 'expense'",
    status_code=status.HTTP_200_OK,
)
async def gastos_por_categoria(
    current_user: UserORM = Depends(get_current_user),
    start_date: str = Query(..., description="Data inicial DD/MM/YYYY"),
    end_date: str = Query(..., description="Data final DD/MM/YYYY"),
    entity_type: str = Query(default='individual', description="Entity type: individual, business ou all"),
    type: Literal["income", "expense"] = Query(..., description="Tipo de transação"),
    db: AsyncSession = Depends(get_session),
):
    dt_i = datetime.strptime(start_date, "%d/%m/%Y")
    dt_f = datetime.strptime(end_date, "%d/%m/%Y")
    dt_f = datetime.combine(dt_f.date(), datetime.max.time())

    repo = DashboardRepository(db)
    categorias = await repo.gastos_por_categoria(
        dt_i, dt_f, entity_type, TipoTrans(type), current_user.id
    )

    return GastosPorCategoriaResponse(
        start_date=start_date,
        end_date=end_date,
        categories=categorias,
    )
@router.get(
    '/category-options',
    response_model=OpcoesCategoriaResponse,
    summary='Opções de categorias e subcategorias',
    description='Retorna lista de categorias com suas respectivas subcategorias.'
)
async def opcoes_categorias(
    current_user: UserORM = Depends(get_current_user),
    entity_type: Literal['individual', 'business', 'all'] = Query('all'),
    type: Optional[str] = Query(None, description="Filtrar por tipo de transacao: income, expense, investment"),
    db: AsyncSession = Depends(get_session)
) -> OpcoesCategoriaResponse:
    
    api_logger = log_api_request('GET', '/dashboard/category-options', entity_type=entity_type, type=type)
    api_logger.info('Gerando opções de categorias', entity_type=entity_type, type=type)

    dashboard_repo = DashboardRepository(db)
    opcoes = await dashboard_repo.opcoes_categorias(entity_type, type, current_user.id)

    api_logger.success('Opções de categorias retornadas', count=len(opcoes.options))
    return opcoes

@router.get(
    '/income-by-category',
    response_model=EntradasPorCategoriaResponse,
    summary='Entradas por subcategoria',
    description='Retorna valores de entradas por subcategoria agrupados por categoria'
)
async def entradas_por_categoria(
    current_user: UserORM = Depends(get_current_user),
    start_date: str = Query(..., description='Data inicial DD/MM/YYYY'),
    end_date: str = Query(..., description='Data final DD/MM/YYYY'),
    entity_type: str = Query(default='individual', description='Entity type: individual, business ou all'),
    db: AsyncSession = Depends(get_session)
):
    api_logger = log_api_request('GET', '/dashboard/income-by-category')
    
    dt_i = parse_date(start_date, 'start_date')
    dt_f = parse_date(end_date, 'end_date')
    dt_f = datetime.combine(dt_f.date(), datetime.max.time())

    dashboard_repo = DashboardRepository(db)
    resultado = await dashboard_repo.entradas_por_categoria(dt_i, dt_f, entity_type, start_date, end_date, current_user.id)

    api_logger.success('Entradas por categoria geradas', count=len(resultado.subcategories))
    return resultado
