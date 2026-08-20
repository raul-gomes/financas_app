from pydantic import BaseModel, Field, model_validator
from typing import Any, Optional
from datetime import date


class MetaCreate(BaseModel):
    """Schema para criar uma nova meta (subcategoria com target_amount)"""
    subcategory_name: str = Field(..., description="Nome da subcategoria/meta")
    target_amount: float = Field(..., gt=0, description="Valor alvo da meta")
    entity_type: str = Field(default="individual", description="Tipo de entidade: individual ou business")


class MetaUpdate(BaseModel):
    """Schema para atualizar uma meta"""
    subcategory_name: Optional[str] = Field(None, description="Nome da subcategoria/meta")
    target_amount: Optional[float] = Field(None, gt=0, description="Valor alvo da meta")


class MetaResponse(BaseModel):
    """Schema de resposta para uma meta"""
    id: int = Field(..., description="ID da subcategoria")
    subcategory_name: str = Field(..., description="Nome da subcategoria/meta")
    target_amount: float = Field(..., description="Valor alvo da meta")
    category_id: int = Field(..., description="ID da categoria 'Metas'")
    completed: bool = Field(False, description="Se a meta foi concluída")
    completed_at: Optional[date] = Field(None, description="Data de conclusão")

    class Config:
        from_attributes = True

    @model_validator(mode='before')
    @classmethod
    def extract_name(cls, data: Any) -> Any:
        if hasattr(data, 'name') and not hasattr(data, 'subcategory_name'):
            setattr(data, 'subcategory_name', data.name)
        return data


class MetaProgresso(BaseModel):
    """Schema para retornar o progresso de uma meta"""
    subcategory_id: int = Field(..., description="ID da subcategoria")
    subcategory_name: str = Field(..., description="Nome da meta")
    target_amount: float = Field(..., description="Valor alvo")
    current_amount: float = Field(..., description="Valor acumulado no mês")
    progress: float = Field(..., description="Porcentagem de progresso (0-100)")
    completed: bool = Field(False, description="Se a meta foi concluída")
    completed_at: Optional[date] = Field(None, description="Data de conclusão")
    entity_type: str = Field(default='individual', description="Tipo de entidade: individual ou business")

    class Config:
        from_attributes = True

    @model_validator(mode='before')
    @classmethod
    def extract_name(cls, data: Any) -> Any:
        if hasattr(data, 'name') and not hasattr(data, 'subcategory_name'):
            setattr(data, 'subcategory_name', data.name)
        if hasattr(data, 'id') and not hasattr(data, 'subcategory_id'):
            setattr(data, 'subcategory_id', data.id)
        return data
