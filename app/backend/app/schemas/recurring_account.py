from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Any, Optional
from datetime import datetime


class ContaRecorrenteBase(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    amount: float = Field(..., gt=0)
    due_day: int = Field(..., ge=1, le=31)
    category_id: int
    subcategory_id: int
    entity_type: str
    payment_method: str
    bank_code: Optional[str] = Field(None, description="Código COMPE do banco")
    start_date: datetime
    end_date: Optional[datetime] = None
    active: bool = True
    total_installments: int = Field(default=12, ge=1, le=12)

    @field_validator('start_date', 'end_date', mode='after')
    @classmethod
    def strip_timezone(cls, v):
        if v is not None and v.tzinfo is not None:
            return v.replace(tzinfo=None)
        return v


class ContaRecorrenteCreate(ContaRecorrenteBase):
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    category_name: Optional[str] = None
    subcategory_name: Optional[str] = None

    @model_validator(mode='before')
    @classmethod
    def check_category(cls, values):
        cid, cnome = values.get('category_id'), values.get('category_name')
        if not cid and not cnome:
            raise ValueError('Informe category_id ou category_name')
        return values

    @model_validator(mode='before')
    @classmethod
    def check_subcategory(cls, values):
        sid, snome = values.get('subcategory_id'), values.get('subcategory_name')
        if not sid and not snome:
            raise ValueError('Informe subcategory_id ou subcategory_name')
        return values


class ContaRecorrenteUpdate(BaseModel):
    description: Optional[str] = Field(None, min_length=1, max_length=500)
    amount: Optional[float] = Field(None, gt=0)
    due_day: Optional[int] = Field(None, ge=1, le=31)
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    category_name: Optional[str] = None
    subcategory_name: Optional[str] = None
    entity_type: Optional[str] = None
    payment_method: Optional[str] = None
    bank_code: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    active: Optional[bool] = None


class ContaRecorrenteResponse(ContaRecorrenteBase):
    id: int
    category_name: Optional[str] = None
    subcategory_name: Optional[str] = None
    remaining_installments: int = 0
    current_installment: int = 0
    is_ending_soon: bool = False

    class Config:
        from_attributes = True

    @model_validator(mode='before')
    @classmethod
    def extract_names(cls, data: Any) -> Any:
        if hasattr(data, 'category') and data.category:
            if not hasattr(data, 'category_name') or data.category_name is None:
                setattr(data, 'category_name', data.category.name)
        if hasattr(data, 'subcategory') and data.subcategory:
            if not hasattr(data, 'subcategory_name') or data.subcategory_name is None:
                setattr(data, 'subcategory_name', data.subcategory.name)
        
        total = getattr(data, 'total_installments', 12) or 12
        remaining = getattr(data, 'remaining_installments', 0) or 0
        current = total - remaining + 1
        if current < 1:
            current = 1
        if current > total:
            current = total
        setattr(data, 'current_installment', current)
        setattr(data, 'is_ending_soon', remaining > 0 and remaining <= 2)
        return data


class GenerateRequest(BaseModel):
    start_date: datetime
    end_date: datetime

    @field_validator('start_date', 'end_date', mode='after')
    @classmethod
    def strip_timezone(cls, v):
        if v is not None and v.tzinfo is not None:
            return v.replace(tzinfo=None)
        return v


class GenerateResponse(BaseModel):
    generated: int
    details: list[str]
