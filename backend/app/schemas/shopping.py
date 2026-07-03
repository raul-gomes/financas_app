from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime


class ShoppingItemCreate(BaseModel):
    """Schema para criar um item de compra"""
    name: str = Field(..., min_length=1, max_length=255, description="Nome do item")
    reference_month: date = Field(..., description="Mês de referência (primeiro dia do mês)")
    entity_type: str = Field(default='individual', description="Tipo de entidade: individual ou business")


class ShoppingItemUpdate(BaseModel):
    """Schema para atualizar um item de compra"""
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    checked: Optional[bool] = Field(None)
    entity_type: Optional[str] = Field(None, description="Tipo de entidade: individual ou business")


class ShoppingItemResponse(BaseModel):
    """Schema de resposta para um item de compra"""
    id: int
    name: str
    reference_month: date
    checked: bool
    completed_at: Optional[date] = None
    created_at: Optional[datetime] = None
    entity_type: str = Field(default='individual', description="Tipo de entidade: individual ou business")

    class Config:
        from_attributes = True
