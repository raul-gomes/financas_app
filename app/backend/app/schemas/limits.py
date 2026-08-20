# app/schemas/limits.py

from pydantic import BaseModel, Field
from typing import List, Optional, Union


class SubcategoriaLimiteUpdate(BaseModel):
    """Schema para subcategoria dentro de payload de limites"""
    id: Optional[int] = Field(None, description="ID da subcategoria (null para novas)")
    subcategory_name: str = Field(..., description="Nome da subcategoria")


class CategoriaLimiteUpdate(BaseModel):
    """Schema para categoria dentro de payload de limites"""
    id: Optional[int] = Field(None, description="ID da categoria (null para novas)")
    category_name: str = Field(..., description="Nome da categoria")
    entity_type: str = Field(..., description="Entity type: individual, business ou mensal")
    limit: float = Field(0, description="Limite da categoria")
    subcategories: List[SubcategoriaLimiteUpdate] = Field(default_factory=list)


class LimitsUpdatePayload(BaseModel):
    """Payload para atualização em lote de limites"""
    new: List[CategoriaLimiteUpdate] = Field(default_factory=list, description="Categorias novas")
    modified: List[CategoriaLimiteUpdate] = Field(default_factory=list, description="Categorias modificadas")
    deleted: List[int] = Field(default_factory=list, description="IDs das categorias a excluir")


class LimitsUpdateResponse(BaseModel):
    """Resposta da operação de update de limites"""
    success: bool = Field(..., description="Status da operação")
    message: str = Field(..., description="Mensagem de retorno")
    created_categories: int = Field(0, description="Número de categorias criadas")
    updated_categories: int = Field(0, description="Número de categorias atualizadas")
    deleted_categories: int = Field(0, description="Número de categorias excluídas")
    created_subcategories: int = Field(0, description="Número de subcategorias criadas")
    updated_subcategories: int = Field(0, description="Número de subcategorias atualizadas")
    errors: List[str] = Field(default_factory=list, description="Lista de erros, se houver")