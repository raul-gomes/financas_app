from enum import Enum

from pydantic import BaseModel, ConfigDict, Field


class TotalDiario(BaseModel):
    """Totals of one day of the period (only days that have transactions are listed)."""

    date: str = Field(..., description="Dia no formato YYYY-MM-DD")
    income: float = Field(default=0, description="Entradas do dia")
    expenses: float = Field(default=0, description="Saídas do dia")
    investment: float = Field(default=0, description="Investimentos do dia")


class TotalFormaPagamento(BaseModel):
    """Expenses of the period paid with one payment method."""

    payment_method: str = Field(..., description="pix, credit, debit...")
    total: float = Field(..., description="Total de saídas na forma de pagamento")


class TotalBanco(BaseModel):
    """Expenses of the period paid with one payment method at one of the user's banks."""

    payment_method: str
    bank_code: str
    bank_name: str = Field(
        ..., description="Nome do banco do usuário (ou o código, se não cadastrado)"
    )
    total: float


class ParcelasBanco(BaseModel):
    """Installments still to pay, grouped by bank (``bank_code`` null = no bank)."""

    bank_code: str | None = None
    bank_name: str
    remaining_amount: float
    remaining_installments: int
    transactions: int


class ParcelasAPagar(BaseModel):
    """Remaining installments of the period's installment expenses ("Parcelas a pagar")."""

    remaining_amount: float = Field(default=0, description="Soma de parcelas restantes x valor")
    remaining_installments: int = Field(default=0, description="Quantidade de parcelas restantes")
    transactions: int = Field(default=0, description="Transações parceladas no período")
    by_bank: list[ParcelasBanco] = Field(default_factory=list)


class ExtratoResponse(BaseModel):
    total_income: float = Field(..., description="Total de entradas no período")
    total_expenses: float = Field(..., description="Total de saídas no período")
    start_date: str = Field(..., description="Data inicial do filtro (dd/mm/yyyy)")
    end_date: str = Field(..., description="Data final do filtro (dd/mm/yyyy)")
    monthly_goal: float = Field(..., description="Meta mensal financeira")
    total_invested: float = Field(
        ..., description="Total investido no período (transações do tipo investment)"
    )
    credit_card_limit: float = Field(default=0, description="Limite do cartão de crédito")
    fixed_expenses: float = Field(
        default=0, description="Total de gastos fixos (contas recorrentes)"
    )
    variable_expenses: float = Field(default=0, description="Total de gastos variáveis")
    daily_totals: list[TotalDiario] = Field(
        default_factory=list,
        description="Entradas/saídas/investimentos por dia (só dias com dados)",
    )
    expenses_by_payment_method: list[TotalFormaPagamento] = Field(
        default_factory=list, description="Saídas do período por forma de pagamento"
    )
    expenses_by_bank: list[TotalBanco] = Field(
        default_factory=list, description="Saídas do período por forma de pagamento e banco"
    )
    installments_due: ParcelasAPagar = Field(
        default_factory=ParcelasAPagar, description="Parcelas a pagar das saídas parceladas"
    )

    model_config = ConfigDict(from_attributes=True)


class MesRendimento(BaseModel):
    income: float = Field(..., description="Total de entradas no mês")
    expense: float = Field(..., description="Total de despesas no mês (base dos limites)")
    outflows: float = Field(..., description="Total de saídas no mês: despesas + investimentos")


class RendimentoPeriodoResponse(BaseModel):
    limit: float = Field(..., description="Limite/metas financeiras")
    months: dict[str, MesRendimento] = Field(
        ..., description="Dados de entrada e saída por mês em minúsculo"
    )

    model_config = ConfigDict(from_attributes=True)


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
    subcategories: list[SubcategoriaGasto] = Field(..., description="Detalhamento por subcategoria")


class GastosPorCategoriaResponse(BaseModel):
    start_date: str = Field(..., description="Data inicial do filtro (DD/MM/YYYY)")
    end_date: str = Field(..., description="Data final do filtro (DD/MM/YYYY)")
    categories: list[CategoriaGasto] = Field(..., description="Categorias com valores agregados")

    model_config = ConfigDict(from_attributes=True)


class SubcategoriaOpcao(BaseModel):
    id: int = Field(..., description="ID da subcategoria")
    name: str = Field(..., description="Nome da subcategoria")


class CategoriaOpcao(BaseModel):
    id: int = Field(..., description="ID da categoria")
    name: str = Field(..., description="Nome da categoria")
    type: str | None = Field(
        default=None, description="Tipo de transação: income, expense, investment, ou null"
    )
    subcategories: list[SubcategoriaOpcao] = Field(..., description="Lista de subcategorias")


class OpcoesCategoriaResponse(BaseModel):
    options: list[CategoriaOpcao] = Field(
        ..., description="Lista de categorias com suas subcategorias"
    )

    model_config = ConfigDict(from_attributes=True)


class EntradaSubcategoriaItem(BaseModel):
    name: str = Field(..., description="Nome da subcategoria")
    total: float = Field(..., description="Total agregado na subcategoria")


class EntradasPorCategoriaResponse(BaseModel):
    start_date: str = Field(..., description="Data inicial do filtro (DD/MM/YYYY)")
    end_date: str = Field(..., description="Data final do filtro (DD/MM/YYYY)")
    subcategories: list[EntradaSubcategoriaItem] = Field(
        ..., description="Lista de subcategorias com entradas agregadas"
    )

    model_config = ConfigDict(from_attributes=True)
