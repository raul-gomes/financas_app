from sqlalchemy import Column, Integer, Float, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base
from uuid import uuid4

class TransactionORM(Base):
    __tablename__ = "transacoes"

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(String, nullable=False, default=lambda: str(uuid4()), index=True)
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=False)
    installment_number = Column(Integer)
    total_installments = Column(Integer)
    is_installment = Column(Boolean, default=False, server_default='false')
    transaction_date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    type = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    payment_method = Column(String, nullable=False)
    bank_code = Column(String, nullable=True)
    category_id = Column(Integer, ForeignKey("categorias.id"), nullable=False)
    subcategory_id = Column(Integer, ForeignKey("subcategorias.id"), nullable=False)
    recurring_account_id = Column(Integer, ForeignKey("recurring_accounts.id"), nullable=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    category = relationship("CategoryORM", lazy="joined")
    subcategory = relationship("SubcategoryORM", lazy="joined")
    recurring_account = relationship("RecurringAccountORM", lazy="selectin")
