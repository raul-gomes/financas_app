from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from datetime import datetime
from enum import Enum


class TotaisOverview(BaseModel):
    """Totais agregados do mês (Indicadores principais da tela)."""

    total_income: float = Field(..., description="Total de entradas no mês")
    total_expenses: float = Field(..., description="Total de saídas no mês")
    total_invested: float = Field(..., description="Total investido no mês")
    balance: float = Field(..., description="Saldo do mês (entradas - saídas)")


class MonthProgressOverview(BaseModel):
    """Progresso do mês até o dia atual (visão rápida do controle financeiro)."""

    day: int = Field(..., description="Dia atual (ou último dia do mês se mês passado)")
    days_in_month: int = Field(..., description="Total de dias do mês")
    percent: float = Field(..., description="Percentual de dias decorridos (0-1)")
    income_up_to_today: float = Field(..., description="Entradas até o dia atual")
    expenses_up_to_today: float = Field(..., description="Saídas até o dia atual")
    balance: float = Field(..., description="Saldo acumulado até o dia atual")


class CreditCardOverview(BaseModel):
    """Uso do cartão de crédito no mês."""

    limit: float = Field(..., description="Limite do cartão de crédito")
    used: float = Field(..., description="Total usado (pagamentos via crédito) no mês")
    remaining: float = Field(..., description="Limite restante")
    percent_used: float = Field(..., description="Percentual de crédito usado (0-100)")


class CategoriaStatusOverview(BaseModel):
    """Status de uma categoria com limite no mês (para estourar/estourado)."""

    id: int
    category_name: str
    entity_type: str
    limit: float
    spent: float
    remaining: float
    percent_used: float
    status: str = Field(
        ..., description="warning (>=70%) | over (>=100%) — só categorias estouradas/quase"
    )


class ParcelaMesOverview(BaseModel):
    """Parcela de uma compra parcelada vencendo no mês."""

    id: int
    description: str
    amount: float
    installment_number: Optional[int]
    total_installments: Optional[int]
    category_name: str
    subcategory_name: str
    payment_method: str
    entity_type: str
    transaction_date: datetime


class RecorrentePagarOverview(BaseModel):
    """Conta recorrente a pagar no mês."""

    id: int
    description: str
    amount: float
    due_day: int
    category_name: str
    subcategory_name: str
    entity_type: str
    payment_method: str
    current_installment: int
    total_installments: int
    remaining_installments: int
    is_ending_soon: bool


class OverviewResponse(BaseModel):
    """Dashboard geral da página principal (1 endpoint = 1 tela)."""

    reference_month: str = Field(..., description="Mês de referência (MM/YYYY)")
    entity_type: str = Field(..., description="Scopo: individual, business ou all")
    totals: TotaisOverview
    month_progress: MonthProgressOverview
    credit_card: CreditCardOverview
    categories_status: List[CategoriaStatusOverview] = Field(default_factory=list)
    installments: List[ParcelaMesOverview] = Field(default_factory=list)
    recurring_accounts: List[RecorrentePagarOverview] = Field(default_factory=list)
    goals: List[Dict[str, Any]] = Field(
        default_factory=list, description="Metas com progresso (somente admin)"
    )
    shopping: List[Dict[str, Any]] = Field(
        default_factory=list, description="Compras do mês (somente admin)"
    )

    class Config:
        from_attributes = True
