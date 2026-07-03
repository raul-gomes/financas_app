# app/schemas/categoria.py

from pydantic import BaseModel, Field, model_validator
from typing import Any, List, Literal, Optional

from app.schemas.subcategory import Subcategoria, SubcategoriaCreate, SubcategoriaUpdate


class CategoriaBase(BaseModel):
    category_name: str = Field(..., description='Nome da categoria')
    entity_type: Literal['individual', 'business', 'all'] = Field(..., description='Natureza da categoria')
    limit: float = Field(..., ge=0, description='Limite associado à categoria')
    type: Optional[Literal['income', 'expense', 'investment']] = Field(
        default=None, description='Tipo de transação: income, expense, ou investment. Null para categorias especiais (ex: limites).'
    )

class CategoriaCreate(CategoriaBase):
    subcategories: List[SubcategoriaCreate] = Field(default_factory=list, description='Lista de subcategorias')

    class Config:
        json_schema_extra = {
            "example": {
                "category_name": "Marketing",
                "entity_type": "business",
                "limit": 5000.00,
                "type": "expense",
                "subcategories": [
                    {"subcategory_name": "Google Ads"},
                    {"subcategory_name": "Facebook Ads"},
                    {"subcategory_name": "Design Gráfico"}
                ]
            }
        }

class Categoria(CategoriaBase):
    id: int = Field(..., description='ID da categoria')
    subcategories: List[Subcategoria] = Field(..., description='Lista de subcategorias')

    class Config:
        from_attributes = True

    @model_validator(mode='before')
    @classmethod
    def extract_names(cls, data: any) -> any:
        if hasattr(data, 'name') and not hasattr(data, 'category_name'):
            setattr(data, 'category_name', data.name)
        if hasattr(data, 'subcategories') and data.subcategories:
            for sub in data.subcategories:
                if hasattr(sub, 'name') and not hasattr(sub, 'subcategory_name'):
                    setattr(sub, 'subcategory_name', sub.name)
        return data

class CategoriaUpdate(BaseModel):
    category_name: Optional[str] = None
    entity_type: Optional[Literal['individual', 'business']] = None
    limit: Optional[float] = None
    type: Optional[Literal['income', 'expense', 'investment']] = None
    subcategories: Optional[List[SubcategoriaUpdate]] = Field(default=None)

    class Config:
        from_attributes = True
