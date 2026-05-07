from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime


class ContaRecorrenteBase(BaseModel):
    descricao: str = Field(..., min_length=1, max_length=500)
    valor: float = Field(..., gt=0)
    dia_vencimento: int = Field(..., ge=1, le=31)
    categoria_id: int
    subcategoria_id: int
    natureza: str
    forma_pagamento: str
    data_inicio: datetime
    data_fim: Optional[datetime] = None
    ativo: bool = True

    @field_validator('data_inicio', 'data_fim', mode='after')
    @classmethod
    def strip_timezone(cls, v):
        if v is not None and v.tzinfo is not None:
            return v.replace(tzinfo=None)
        return v


class ContaRecorrenteCreate(ContaRecorrenteBase):
    pass


class ContaRecorrenteUpdate(BaseModel):
    descricao: Optional[str] = Field(None, min_length=1, max_length=500)
    valor: Optional[float] = Field(None, gt=0)
    dia_vencimento: Optional[int] = Field(None, ge=1, le=31)
    categoria_id: Optional[int] = None
    subcategoria_id: Optional[int] = None
    natureza: Optional[str] = None
    forma_pagamento: Optional[str] = None
    data_inicio: Optional[datetime] = None
    data_fim: Optional[datetime] = None
    ativo: Optional[bool] = None


class ContaRecorrenteResponse(ContaRecorrenteBase):
    id: int
    categoria_nome: Optional[str] = None
    subcategoria_nome: Optional[str] = None

    class Config:
        from_attributes = True


class GenerateRequest(BaseModel):
    data_inicio: datetime
    data_final: datetime

    @field_validator('data_inicio', 'data_final', mode='after')
    @classmethod
    def strip_timezone(cls, v):
        if v is not None and v.tzinfo is not None:
            return v.replace(tzinfo=None)
        return v


class GenerateResponse(BaseModel):
    geradas: int
    detalhes: list[str]
