from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.services.recurring_installments import installment_state


class ContaRecorrenteBase(BaseModel):
    description: str = Field(..., min_length=1, max_length=500)
    amount: float = Field(..., gt=0)
    due_day: int = Field(..., ge=1, le=31)
    category_id: int
    subcategory_id: int
    entity_type: str
    payment_method: str
    bank_code: str | None = Field(None, description="Código COMPE do banco")
    start_date: datetime
    end_date: datetime | None = None
    active: bool = True
    total_installments: int = Field(default=12, ge=1, le=12)

    @field_validator("start_date", "end_date", mode="after")
    @classmethod
    def strip_timezone(cls, v):
        if v is not None and v.tzinfo is not None:
            return v.replace(tzinfo=None)
        return v


class ContaRecorrenteCreate(ContaRecorrenteBase):
    category_id: int | None = None
    subcategory_id: int | None = None
    category_name: str | None = None
    subcategory_name: str | None = None

    @model_validator(mode="before")
    @classmethod
    def check_category(cls, values):
        cid, cnome = values.get("category_id"), values.get("category_name")
        if not cid and not cnome:
            raise ValueError("Informe category_id ou category_name")
        return values

    @model_validator(mode="before")
    @classmethod
    def check_subcategory(cls, values):
        sid, snome = values.get("subcategory_id"), values.get("subcategory_name")
        if not sid and not snome:
            raise ValueError("Informe subcategory_id ou subcategory_name")
        return values


class ContaRecorrenteUpdate(BaseModel):
    description: str | None = Field(None, min_length=1, max_length=500)
    amount: float | None = Field(None, gt=0)
    due_day: int | None = Field(None, ge=1, le=31)
    category_id: int | None = None
    subcategory_id: int | None = None
    category_name: str | None = None
    subcategory_name: str | None = None
    entity_type: str | None = None
    payment_method: str | None = None
    bank_code: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    active: bool | None = None


class ContaRecorrenteResponse(ContaRecorrenteBase):
    id: int
    category_name: str | None = None
    subcategory_name: str | None = None
    remaining_installments: int = 0
    current_installment: int = 0
    is_ending_soon: bool = False
    can_renew: bool = True

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def extract_names(cls, data: Any) -> Any:
        if (
            hasattr(data, "category")
            and data.category
            and (not hasattr(data, "category_name") or data.category_name is None)
        ):
            data.category_name = data.category.name
        if (
            hasattr(data, "subcategory")
            and data.subcategory
            and (not hasattr(data, "subcategory_name") or data.subcategory_name is None)
        ):
            data.subcategory_name = data.subcategory.name

        state = installment_state(
            getattr(data, "total_installments", None),
            getattr(data, "remaining_installments", 0),
            active=bool(getattr(data, "active", True)),
        )
        data.current_installment = state.current_installment
        data.is_ending_soon = state.is_ending_soon
        data.can_renew = state.can_renew
        return data
