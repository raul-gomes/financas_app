from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime
from uuid import UUID


class ShoppingItemCreate(BaseModel):
    """Schema para criar um item de compra"""
    name: str = Field(..., min_length=1, max_length=255, description="Nome do item")
    reference_month: date = Field(..., description="Mês de referência (primeiro dia do mês)")
    entity_type: str = Field(default='individual', description="Tipo de entidade: individual ou business")
    # Recurring fields
    is_recurring: bool = Field(default=False, description="Se o item é recorrente (aparece nos meses seguintes)")
    recurrence_end_date: Optional[date] = Field(None, description="Data fim da recorrência")


class ShoppingItemUpdate(BaseModel):
    """Schema para atualizar um item de compra"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    checked: Optional[bool] = Field(None)
    entity_type: Optional[str] = Field(None, description="Tipo de entidade: individual ou business")
    # Recurring fields
    is_recurring: Optional[bool] = Field(None, description="Se o item é recorrente")
    recurrence_end_date: Optional[date] = Field(None, description="Data fim da recorrência")


class ShoppingItemResponse(BaseModel):
    """Schema de resposta para um item de compra"""
    id: int
    name: str
    reference_month: date
    checked: bool
    completed_at: Optional[date] = None
    created_at: Optional[datetime] = None
    entity_type: str = Field(default='individual', description="Tipo de entidade: individual ou business")
    # Recurring fields
    is_recurring: bool = Field(default=False)
    recurrence_group_id: Optional[UUID] = None
    recurrence_end_date: Optional[date] = None

    class Config:
        from_attributes = True


class GenerateRecurringShoppingRequest(BaseModel):
    """Schema para gerar itens recorrentes de compras"""
    start_month: date = Field(..., description="Mês inicial (primeiro dia)")
    end_month: date = Field(..., description="Mês final (primeiro dia)")
    entity_type: Optional[str] = Field(None, description="Filtrar por tipo de entidade")
