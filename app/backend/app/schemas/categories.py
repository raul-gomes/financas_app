# app/schemas/categoria.py

from typing import Literal

from pydantic import BaseModel, Field, model_validator

from app.schemas.subcategory import Subcategoria, SubcategoriaCreate, SubcategoriaUpdate


class CategoriaBase(BaseModel):
    category_name: str = Field(..., description="Nome da categoria")
    entity_type: Literal["individual", "business", "all"] = Field(
        ..., description="Natureza da categoria"
    )
    limit: float = Field(..., ge=0, description="Limite associado à categoria")
    type: Literal["income", "expense", "investment"] | None = Field(
        default=None,
        description="Tipo de transação: income, expense, ou investment. Null para categorias especiais (ex: limites).",
    )


class CategoriaCreate(CategoriaBase):
    subcategories: list[SubcategoriaCreate] = Field(
        default_factory=list, description="Lista de subcategorias"
    )

    class Config:
        json_schema_extra = {  # noqa: RUF012  # pydantic config dict, never mutated
            "example": {
                "category_name": "Marketing",
                "entity_type": "business",
                "limit": 5000.00,
                "type": "expense",
                "subcategories": [
                    {"subcategory_name": "Google Ads"},
                    {"subcategory_name": "Facebook Ads"},
                    {"subcategory_name": "Design Gráfico"},
                ],
            }
        }


class Categoria(CategoriaBase):
    id: int = Field(..., description="ID da categoria")
    subcategories: list[Subcategoria] = Field(..., description="Lista de subcategorias")

    class Config:
        from_attributes = True

    @model_validator(mode="before")
    @classmethod
    def extract_names(cls, data: any) -> any:
        if hasattr(data, "name") and not hasattr(data, "category_name"):
            data.category_name = data.name
        if hasattr(data, "subcategories") and data.subcategories:
            for sub in data.subcategories:
                if hasattr(sub, "name") and not hasattr(sub, "subcategory_name"):
                    sub.subcategory_name = sub.name
        return data


class CategoriaUpdate(BaseModel):
    category_name: str | None = None
    entity_type: Literal["individual", "business"] | None = None
    limit: float | None = None
    type: Literal["income", "expense", "investment"] | None = None
    subcategories: list[SubcategoriaUpdate] | None = Field(default=None)

    class Config:
        from_attributes = True
