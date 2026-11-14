from datetime import datetime

from pydantic import BaseModel


class ProfileResponse(BaseModel):
    id: int
    name: str
    email: str
    pluggy_api_key: str | None = None
    role: str = "user"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    name: str | None = None
    email: str | None = None
    password: str | None = None
    pluggy_api_key: str | None = None


class BankResponse(BaseModel):
    id: int
    bank_code: str
    bank_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class BankCreate(BaseModel):
    bank_code: str
    bank_name: str
