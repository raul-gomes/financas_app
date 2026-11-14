from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ShoppingItemCreate(BaseModel):
    """Schema para criar um item de compra"""

    name: str = Field(..., min_length=1, max_length=255, description="Nome do item")
    reference_month: date = Field(..., description="Mês de referência (primeiro dia do mês)")
    entity_type: str = Field(
        default="individual", description="Tipo de entidade: individual ou business"
    )
    # Recurring fields
    is_recurring: bool = Field(
        default=False, description="Se o item é recorrente (aparece nos meses seguintes)"
    )
    recurrence_end_date: date | None = Field(None, description="Data fim da recorrência")


class ShoppingItemUpdate(BaseModel):
    """Schema para atualizar um item de compra"""

    name: str | None = Field(None, min_length=1, max_length=255)
    checked: bool | None = Field(None)
    entity_type: str | None = Field(None, description="Tipo de entidade: individual ou business")
    # Recurring fields
    is_recurring: bool | None = Field(None, description="Se o item é recorrente")
    recurrence_end_date: date | None = Field(None, description="Data fim da recorrência")


class ShoppingItemResponse(BaseModel):
    """Schema de resposta para um item de compra"""

    id: int
    name: str
    reference_month: date
    checked: bool
    completed_at: date | None = None
    created_at: datetime | None = None
    entity_type: str = Field(
        default="individual", description="Tipo de entidade: individual ou business"
    )
    # Recurring fields
    is_recurring: bool = Field(default=False)
    recurrence_group_id: UUID | None = None
    recurrence_end_date: date | None = None

    model_config = ConfigDict(from_attributes=True)


class GenerateRecurringShoppingRequest(BaseModel):
    """Schema para gerar itens recorrentes de compras"""

    start_month: date = Field(..., description="Mês inicial (primeiro dia)")
    end_month: date = Field(..., description="Mês final (primeiro dia)")
    entity_type: str | None = Field(None, description="Filtrar por tipo de entidade")
