from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, func
from sqlalchemy.orm import relationship
from app.db.base import Base


class UserBankORM(Base):
    __tablename__ = "user_banks"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    bank_code = Column(String, nullable=False)
    bank_name = Column(String, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    user = relationship("UserORM", back_populates="banks")
