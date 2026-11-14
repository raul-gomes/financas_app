from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator


class ProfileResponse(BaseModel):
    """Profile as shown to its owner. The Pluggy key itself is never returned."""

    id: int
    name: str
    email: str
    has_pluggy_key: bool = False
    role: str = "user"
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

    @model_validator(mode="before")
    @classmethod
    def _flag_pluggy_key(cls, data: Any) -> Any:
        """Derive ``has_pluggy_key`` from the ORM row without exposing the key."""
        if isinstance(data, dict):
            return data
        return {
            field: getattr(data, field)
            for field in ("id", "name", "email", "role", "created_at", "updated_at")
        } | {"has_pluggy_key": bool(getattr(data, "pluggy_api_key", None))}


class ProfileUpdate(BaseModel):
    """Fields the app owns. E-mail and password belong to Supabase Auth.

    ``pluggy_api_key=""`` removes the stored key.
    """

    model_config = ConfigDict(extra="forbid")

    name: str | None = None
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
