from pydantic import BaseModel, Field
from typing import Optional, List


class ParsedTransaction(BaseModel):
    date: str
    description: str
    amount: float
    type: str
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    payment_method: Optional[str] = None
    entity_type: Optional[str] = None


class UploadResponse(BaseModel):
    total: int
    total_income: int
    total_expenses: int
    total_income_amount: float
    total_expenses_amount: float
    transactions: List[ParsedTransaction]


class ConfirmTransaction(BaseModel):
    date: str
    description: str
    amount: float
    type: str
    category_id: Optional[int] = None
    subcategory_id: Optional[int] = None
    category_name: Optional[str] = None
    subcategory_name: Optional[str] = None
    payment_method: str = Field(default='pix')
    entity_type: str = Field(default='individual')
    bank_code: Optional[str] = None
    total_installments: Optional[int] = None
    is_installment: bool = False


class ConfirmPayload(BaseModel):
    transactions: List[ConfirmTransaction]


class ConfirmResponse(BaseModel):
    created: int
    errors: List[str]
