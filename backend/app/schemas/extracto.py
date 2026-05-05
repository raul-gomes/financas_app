from pydantic import BaseModel, Field
from typing import Optional, List


class ParsedTransaction(BaseModel):
    data: str
    descricao: str
    valor: float
    tipo: str
    categoria_id: Optional[int] = None
    subcategoria_id: Optional[int] = None


class UploadResponse(BaseModel):
    total: int
    entradas: int
    saidas: int
    total_entradas: float
    total_saidas: float
    transacoes: List[ParsedTransaction]


class ConfirmTransaction(BaseModel):
    data: str
    descricao: str
    valor: float
    tipo: str
    categoria_id: int
    subcategoria_id: int
    forma_pagamento: str = Field(default='pix')
    natureza: str = Field(default='pf')


class ConfirmPayload(BaseModel):
    transacoes: List[ConfirmTransaction]


class ConfirmResponse(BaseModel):
    criadas: int
    erros: List[str]
