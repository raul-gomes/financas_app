from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class ProfileResponse(BaseModel):
    id: int
    name: str
    email: str
    pluggy_api_key: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    pluggy_api_key: Optional[str] = None


class BankResponse(BaseModel):
    id: int
    bank_code: str
    bank_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class BankCreate(BaseModel):
    bank_code: str
    bank_name: str
