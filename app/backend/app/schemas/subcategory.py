from typing import Any

from pydantic import BaseModel, Field, model_validator


class SubcategoriaBase(BaseModel):
    subcategory_name: str = Field(..., description="Nome da subcategoria")


class Subcategoria(SubcategoriaBase):
    id: int = Field(..., description="ID da subcategoria")
    target_amount: float | None = Field(None, description="Valor alvo (se for meta)")

    class Config:
        from_attributes = True

    @model_validator(mode="before")
    @classmethod
    def extract_name(cls, data: Any) -> Any:
        if hasattr(data, "name") and not hasattr(data, "subcategory_name"):
            data.subcategory_name = data.name
        return data


class SubcategoriaCreate(SubcategoriaBase):
    """Schema para criar subcategorias (sem id)"""

    pass


class SubcategoriaUpdate(SubcategoriaBase):
    id: int | None = Field(None, description="ID da subcategoria existente")

    class Config:
        from_attributes = True
