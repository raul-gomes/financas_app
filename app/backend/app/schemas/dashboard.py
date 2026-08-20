from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional
from datetime import datetime

from enum import Enum

from app.schemas.transaction import NaturezaTransacao, TipoTransacao

class TransacaoExtrato(BaseModel):
    id: int
    type: TipoTransacao
    amount: float
    description: str
    category_id: int
    subcategory_id: int
    category_name: str
    subcategory_name: str
    payment_method: str
    installment_number: Optional[int]
    total_installments: Optional[int]
    is_installment: bool = False
    entity_type: NaturezaTransacao
    transaction_date: datetime
    recurring_account_id: Optional[int] = None
    bank_code: Optional[str] = None

    class Config:
        from_attributes = True


class ExtratoResponse(BaseModel):
    total_income: float = Field(..., description="Total de entradas no período")
    total_expenses: float = Field(..., description="Total de saídas no período")
    start_date: str = Field(..., description="Data inicial do filtro (dd/mm/yyyy)")
    end_date: str = Field(..., description="Data final do filtro (dd/mm/yyyy)")
    monthly_goal: float = Field(..., description="Meta mensal financeira")
    total_invested: float = Field(..., description="Total investido (igual às entradas)")
    transactions: List[TransacaoExtrato] = Field(..., description="Lista de transações filtradas")
    credit_card_limit: float = Field(default=0, description="Limite do cartão de crédito")
    fixed_expenses: float = Field(default=0, description="Total de gastos fixos (contas recorrentes)")
    variable_expenses: float = Field(default=0, description="Total de gastos variáveis")

    class Config:
        from_attributes = True


class MesRendimento(BaseModel):
    income: float = Field(..., description="Total de entradas no mês")
    expense: float = Field(..., description="Total de saídas no mês")


class RendimentoPeriodoResponse(BaseModel):
    limit: float = Field(..., description="Limite/metas financeiras")
    months: Dict[str, MesRendimento] = Field(..., description="Dados de entrada e saída por mês em minúsculo")

    class Config:
        from_attributes = True

# app/schemas/dashboard.py

class TipoTrans(Enum):
    income = "income"
    expense = "expense"

class SubcategoriaGasto(BaseModel):
    name: str = Field(..., description="Nome da subcategoria")
    amount: str = Field(..., description="Valor agregado à subcategoria")


class CategoriaGasto(BaseModel):
    name: str = Field(..., description="Nome da categoria")
    total: float = Field(..., description="Total agregado na categoria")
    limit: float = Field(..., description="Limite configurado na categoria")
    subcategories: List[SubcategoriaGasto] = Field(
        ..., description="Detalhamento por subcategoria"
    )


class GastosPorCategoriaResponse(BaseModel):
    start_date: str = Field(..., description="Data inicial do filtro (DD/MM/YYYY)")
    end_date: str = Field(..., description="Data final do filtro (DD/MM/YYYY)")
    categories: List[CategoriaGasto] = Field(
        ..., description="Categorias com valores agregados"
    )

    class Config:
        from_attributes = True

class SubcategoriaOpcao(BaseModel):
    id: int = Field(..., description="ID da subcategoria")
    name: str = Field(..., description="Nome da subcategoria")

class CategoriaOpcao(BaseModel):
    id: int = Field(..., description="ID da categoria")
    name: str = Field(..., description="Nome da categoria")
    type: Optional[str] = Field(default=None, description="Tipo de transação: income, expense, investment, ou null")
    subcategories: List[SubcategoriaOpcao] = Field(..., description="Lista de subcategorias")

class OpcoesCategoriaResponse(BaseModel):
    options: List[CategoriaOpcao] = Field(..., description="Lista de categorias com suas subcategorias")
    class Config:
        from_attributes = True

class EntradaSubcategoriaItem(BaseModel):
    name: str = Field(..., description="Nome da subcategoria")
    total: float = Field(..., description="Total agregado na subcategoria")

class EntradasPorCategoriaResponse(BaseModel):
    start_date: str = Field(..., description="Data inicial do filtro (DD/MM/YYYY)")
    end_date: str = Field(..., description="Data final do filtro (DD/MM/YYYY)")
    subcategories: List[EntradaSubcategoriaItem] = Field(
        ..., description="Lista de subcategorias com entradas agregadas"
    )
    
    class Config:
        from_attributes = True