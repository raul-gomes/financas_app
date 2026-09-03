from sqlalchemy import Column, Integer, String, DateTime, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class UserORM(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, default="")
    email = Column(String, unique=True, nullable=False)
    password_hash = Column(String, nullable=False, default="")
    pluggy_api_key = Column(String, nullable=True, default=None)
    role = Column(String(32), nullable=False, server_default="user")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    banks = relationship(
        "UserBankORM",
        back_populates="user",
        cascade="all, delete-orphan",
        lazy="selectin",
    )
