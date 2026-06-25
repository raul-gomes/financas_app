from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


class MetaCreate(BaseModel):
    """Schema para criar uma nova meta (subcategoria com valor_alvo)"""
    subcategoria_nome: str = Field(..., description="Nome da subcategoria/meta")
    valor_alvo: float = Field(..., gt=0, description="Valor alvo da meta")


class MetaUpdate(BaseModel):
    """Schema para atualizar uma meta"""
    subcategoria_nome: Optional[str] = Field(None, description="Nome da subcategoria/meta")
    valor_alvo: Optional[float] = Field(None, gt=0, description="Valor alvo da meta")


class MetaResponse(BaseModel):
    """Schema de resposta para uma meta"""
    id: int = Field(..., description="ID da subcategoria")
    subcategoria_nome: str = Field(..., description="Nome da subcategoria/meta")
    valor_alvo: float = Field(..., description="Valor alvo da meta")
    categoria_id: int = Field(..., description="ID da categoria 'Metas'")
    concluida: bool = Field(False, description="Se a meta foi concluída")
    data_conclusao: Optional[date] = Field(None, description="Data de conclusão")

    class Config:
        from_attributes = True


class MetaProgresso(BaseModel):
    """Schema para retornar o progresso de uma meta"""
    subcategoria_id: int = Field(..., description="ID da subcategoria")
    subcategoria_nome: str = Field(..., description="Nome da meta")
    valor_alvo: float = Field(..., description="Valor alvo")
    valor_atual: float = Field(..., description="Valor acumulado no mês")
    progresso: float = Field(..., description="Porcentagem de progresso (0-100)")
    concluida: bool = Field(False, description="Se a meta foi concluída")
    data_conclusao: Optional[date] = Field(None, description="Data de conclusão")

    class Config:
        from_attributes = True
