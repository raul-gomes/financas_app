from pydantic import BaseModel, Field


class ParsedTransaction(BaseModel):
    date: str
    description: str
    amount: float
    type: str
    category_id: int | None = None
    subcategory_id: int | None = None
    payment_method: str | None = None
    entity_type: str | None = None


class UploadResponse(BaseModel):
    total: int
    total_income: int
    total_expenses: int
    total_income_amount: float
    total_expenses_amount: float
    transactions: list[ParsedTransaction]


class ConfirmTransaction(BaseModel):
    date: str
    description: str
    amount: float
    type: str
    category_id: int | None = None
    subcategory_id: int | None = None
    category_name: str | None = None
    subcategory_name: str | None = None
    payment_method: str = Field(default="pix")
    entity_type: str = Field(default="individual")
    bank_code: str | None = None
    total_installments: int | None = None
    is_installment: bool = False


class ConfirmPayload(BaseModel):
    transactions: list[ConfirmTransaction]


class ConfirmResponse(BaseModel):
    created: int
    errors: list[str]
