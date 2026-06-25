from pydantic import BaseModel, Field
from typing import Optional
from datetime import date, datetime


class ShoppingItemCreate(BaseModel):
    """Schema para criar um item de compra"""
    nome: str = Field(..., min_length=1, max_length=255, description="Nome do item")
    mes_ref: date = Field(..., description="Mês de referência (primeiro dia do mês)")


class ShoppingItemUpdate(BaseModel):
    """Schema para atualizar um item de compra"""
    nome: Optional[str] = Field(None, min_length=1, max_length=255)
    marcado: Optional[bool] = Field(None)


class ShoppingItemResponse(BaseModel):
    """Schema de resposta para um item de compra"""
    id: int
    nome: str
    mes_ref: date
    marcado: bool
    data_conclusao: Optional[date] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
