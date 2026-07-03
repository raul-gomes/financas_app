from pydantic import BaseModel, Field, ValidationInfo, model_validator, field_validator
from typing import Optional, List
from datetime import date, datetime
from enum import Enum
from uuid import UUID


class TipoTransacao(str, Enum):
    ENTRADA = 'income'
    SAIDA = 'expense'
    INVESTIMENTO = 'investment'


class NaturezaTransacao(str, Enum):
    PF = 'individual'
    PJ = 'business'


class TipoPagamento(str, Enum):
    CREDITO = 'credit'
    DEBITO = 'debit'
    PIX = 'pix'
    TRANSFERENCIA = 'transfer'
    DINHEIRO = 'cash'
    BOLETO = 'boleto'


class TransacaoBase(BaseModel):
    amount: float = Field(..., gt=0, description='Valor de transação')
    description: str = Field(..., min_length=1, max_length=500)
    installment_number: Optional[int] = Field(None, ge=1)
    total_installments: Optional[int] = Field(None, ge=1)
    is_installment: bool = Field(False, description='Indica se a transação é parcelada')
    bank_code: Optional[str] = Field(None, description='Código COMPE do banco')
    payment_method: str = Field(..., description='Forma de pagamento (aceita qualquer string)')
    transaction_date: datetime = Field(...)

    @field_validator('transaction_date', mode='after')
    @classmethod
    def strip_timezone(cls, v):
        if v is not None and v.tzinfo is not None:
            return v.replace(tzinfo=None)
        return v


class TransacaoCreate(TransacaoBase):
    type: TipoTransacao
    entity_type: NaturezaTransacao

    category_id: Optional[int] = Field(None, description='ID da categoria')
    category_name: Optional[str] = Field(None, description='Nome da categoria')

    subcategory_id: Optional[int] = Field(None, description='ID da subcategoria')
    subcategory_name: Optional[str] = Field(None, description='Nome da subcategoria')

    @model_validator(mode='before')
    def check_category(cls, values):
        cid, cnome = values.get('category_id'), values.get('category_name')
        if not cid and not cnome:
            raise ValueError('Informe category_id ou category_name')
        return values

    @model_validator(mode='before')
    def check_subcategory(cls, values):
        sid, snome = values.get('subcategory_id'), values.get('subcategory_name')
        if not sid and not snome:
            raise ValueError('Informe subcategory_id ou subcategory_name')
        return values


class TransacaoResponse(TransacaoBase):
    id: int
    group_id: UUID
    type: TipoTransacao
    entity_type: NaturezaTransacao
    category_id: int
    subcategory_id: int
    category_name: Optional[str] = None
    subcategory_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    @model_validator(mode='before')
    @classmethod
    def extract_names(cls, data: any) -> any:
        # If it's an ORM object with loaded relationships
        if hasattr(data, 'category') and data.category:
            setattr(data, 'category_name', data.category.name)
        if hasattr(data, 'subcategory') and data.subcategory:
            setattr(data, 'subcategory_name', data.subcategory.name)
        return data

    class Config:
        from_attributes = True
        populate_by_name = True


class TransacaoUpdate(BaseModel):
    amount: Optional[float] = Field(None, gt=0, description='Valor da transação')
    description: Optional[str] = Field(None, min_length=1, max_length=500, description='Descrição da transação')
    installment_number: Optional[int] = Field(None, ge=1, description='Número de parcelas')
    total_installments: Optional[int] = Field(None, ge=1, description='Total de parcelas')
    is_installment: Optional[bool] = Field(None, description='Indica se a transação é parcelada')
    transaction_date: Optional[datetime] = Field(None, description='Data da transação')
    type: Optional[TipoTransacao] = Field(None, description='Tipo da transação')
    entity_type: Optional[NaturezaTransacao] = Field(None, description='Entity type da transação')
    payment_method: Optional[str] = Field(None, description='Forma de pagamento')

    category_id: Optional[int] = Field(None, description='ID da categoria')
    category_name: Optional[str] = Field(None, description='Nome da categoria')

    subcategory_id: Optional[int] = Field(None, description='ID da subcategoria')
    subcategory_name: Optional[str] = Field(None, description='Nome da subcategoria')
    bank_code: Optional[str] = Field(None, description='Código do banco')
    
    @model_validator(mode="before")
    def check_category(cls, values: dict) -> dict:
        # Só checa se algum campo foi enviado
        if "category_id" in values or "category_name" in values:
            cid = values.get("category_id")
            cnome = values.get("category_name")
            if cid is None and not cnome:
                raise ValueError("Informe category_id ou category_name")
        return values

    @model_validator(mode="before")
    def check_subcategory(cls, values: dict) -> dict:
        # Só checa se algum campo foi enviado
        if "subcategory_id" in values or "subcategory_name" in values:
            sid = values.get("subcategory_id")
            snome = values.get("subcategory_name")
            if sid is None and not snome:
                raise ValueError("Informe subcategory_id ou subcategory_name")
        return values

    class Config:
        from_attributes = True


# ===== Duplicate Checking =====

class SingleDuplicateCheckItem(BaseModel):
    index: int
    transaction_date: date
    amount: float


class DuplicateCheckRequest(BaseModel):
    transaction_date: Optional[date] = None
    amount: Optional[float] = None
    transactions: Optional[List[SingleDuplicateCheckItem]] = None


class DuplicateInfo(BaseModel):
    id: int
    description: str
    amount: float
    transaction_date: datetime
    type: str
    entity_type: str
    category_name: Optional[str] = None
    subcategory_name: Optional[str] = None
    payment_method: Optional[str] = None
    created_at: Optional[datetime] = None


class SingleDuplicateCheckResult(BaseModel):
    index: int
    has_duplicate: bool
    duplicates: List[DuplicateInfo]


class DuplicateCheckResponse(BaseModel):
    results: List[SingleDuplicateCheckResult]


# ===== Duplicate Resolution (for Pluggy sync) =====

class DuplicateResolution(BaseModel):
    new_id: int
    existing_id: int
    action: str = Field(..., pattern=r"^(keep_both|keep_new|keep_existing)$")


class ResolveDuplicatesRequest(BaseModel):
    resolutions: List[DuplicateResolution]


class ResolveDuplicatesResponse(BaseModel):
    resolved: int
    deleted: int
    kept: int