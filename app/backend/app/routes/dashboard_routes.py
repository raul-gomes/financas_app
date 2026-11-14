"""Dashboard routes: HTTP concerns only. Aggregations live in repositories (SQL), rules in
DashboardService, and the user always comes from the verified token."""

from datetime import datetime
from typing import Literal

from fastapi import APIRouter, Depends, Query, status

from app.logger import log_api_request
from app.routes.dependencies import get_dashboard_service, parse_date
from app.schemas.dashboard import (
    EntradasPorCategoriaResponse,
    ExtratoResponse,
    GastosPorCategoriaResponse,
    OpcoesCategoriaResponse,
    RendimentoPeriodoResponse,
    TipoTrans,
)
from app.schemas.overview import OverviewResponse
from app.services.dashboard_service import DashboardService

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


def _end_of_day(day: datetime) -> datetime:
    """Extends a parsed date to the last instant of that day (inclusive range end)."""
    return datetime.combine(day.date(), datetime.max.time())


@router.get(
    "/overview",
    response_model=OverviewResponse,
    summary="Dashboard geral (página principal)",
    description="Indicadores do mês, status de categorias com limite, parcelas do mês, contas recorrentes a pagar, cartão de crédito, metas e compras. Metas/compras somente para admin.",
    status_code=status.HTTP_200_OK,
)
async def overview_geral(
    year: int = Query(..., description="Ano (YYYY)"),
    month: int = Query(..., ge=1, le=12, description="Mês (1-12)"),
    entity_type: str = Query(default="all", description="Entity type: individual, business ou all"),
    service: DashboardService = Depends(get_dashboard_service),
):
    api_logger = log_api_request(
        "GET", "/dashboard/overview", year=year, month=month, entity_type=entity_type
    )
    overview = await service.overview(year, month, entity_type)

    api_logger.success("Overview gerado", reference_month=overview.reference_month)
    return overview


@router.get(
    "/statement",
    response_model=ExtratoResponse,
    summary="Extrato financeiro completo",
    description=(
        "Retorna entradas, saídas, meta, agregados dos gráficos (por dia, forma de pagamento, "
        "banco e parcelas a pagar) e, DEPRECADA, a lista de transações do período"
    ),
    status_code=status.HTTP_200_OK,
)
async def extrato_financeiro(
    start_date: str = Query(..., description="Data inicial DD/MM/YYYY"),
    end_date: str = Query(..., description="Data final DD/MM/YYYY"),
    entity_type: str = Query(
        default="individual", description="Entity type: individual, business ou all"
    ),
    service: DashboardService = Depends(get_dashboard_service),
):
    api_logger = log_api_request("GET", "/dashboard/statement")

    dt_i = parse_date(start_date, "start_date")
    dt_f = _end_of_day(parse_date(end_date, "end_date"))

    extrato = await service.statement(dt_i, dt_f, entity_type, start_date, end_date)

    api_logger.success(
        "Extrato gerado",
        total_income=extrato.total_income,
        total_expenses=extrato.total_expenses,
        count=len(extrato.transactions),
    )

    return extrato


@router.get(
    "/period-income",
    response_model=RendimentoPeriodoResponse,
    summary="Rendimento por período",
    description="Retorna entradas/saídas agregadas por mês no ano",
)
async def rendimento_periodo(
    year: int = Query(..., description="Ano para agregação (YYYY)"),
    entity_type: str = Query(
        default="individual", description="Entity type: individual, business ou all"
    ),
    service: DashboardService = Depends(get_dashboard_service),
):
    api_logger = log_api_request("GET", "/dashboard/period-income")

    rendimento_ano = await service.period_income(year, entity_type)

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
    start_date: str = Query(..., description="Data inicial DD/MM/YYYY"),
    end_date: str = Query(..., description="Data final DD/MM/YYYY"),
    entity_type: str = Query(
        default="individual", description="Entity type: individual, business ou all"
    ),
    type: Literal["income", "expense"] = Query(..., description="Tipo de transação"),
    service: DashboardService = Depends(get_dashboard_service),
):
    dt_i = parse_date(start_date, "start_date")
    dt_f = _end_of_day(parse_date(end_date, "end_date"))

    categorias = await service.breakdown_by_category(dt_i, dt_f, entity_type, TipoTrans(type))

    return GastosPorCategoriaResponse(
        start_date=start_date,
        end_date=end_date,
        categories=categorias,
    )


@router.get(
    "/category-options",
    response_model=OpcoesCategoriaResponse,
    summary="Opções de categorias e subcategorias",
    description="Retorna lista de categorias com suas respectivas subcategorias.",
)
async def opcoes_categorias(
    entity_type: Literal["individual", "business", "all"] = Query("all"),
    type: str | None = Query(
        None, description="Filtrar por tipo de transacao: income, expense, investment"
    ),
    service: DashboardService = Depends(get_dashboard_service),
) -> OpcoesCategoriaResponse:

    api_logger = log_api_request(
        "GET", "/dashboard/category-options", entity_type=entity_type, type=type
    )
    api_logger.info("Gerando opções de categorias", entity_type=entity_type, type=type)

    opcoes = await service.category_options(entity_type, type)

    api_logger.success("Opções de categorias retornadas", count=len(opcoes.options))
    return opcoes


@router.get(
    "/income-by-category",
    response_model=EntradasPorCategoriaResponse,
    summary="Entradas por subcategoria",
    description="Retorna valores de entradas por subcategoria agrupados por categoria",
)
async def entradas_por_categoria(
    start_date: str = Query(..., description="Data inicial DD/MM/YYYY"),
    end_date: str = Query(..., description="Data final DD/MM/YYYY"),
    entity_type: str = Query(
        default="individual", description="Entity type: individual, business ou all"
    ),
    service: DashboardService = Depends(get_dashboard_service),
):
    api_logger = log_api_request("GET", "/dashboard/income-by-category")

    dt_i = parse_date(start_date, "start_date")
    dt_f = _end_of_day(parse_date(end_date, "end_date"))

    resultado = await service.income_by_subcategory(dt_i, dt_f, entity_type, start_date, end_date)

    api_logger.success("Entradas por categoria geradas", count=len(resultado.subcategories))
    return resultado
