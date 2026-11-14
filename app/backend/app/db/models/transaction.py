from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    func,
)
from sqlalchemy.orm import relationship

from app.db.base import Base


class TransactionORM(Base):
    __tablename__ = "transacoes"
    __table_args__ = (
        Index("idx_transacoes_cat_date", "category_id", "transaction_date"),
        Index("idx_transacoes_entity_date", "entity_type", "transaction_date"),
        Index("idx_transacoes_recurring", "recurring_account_id", "transaction_date"),
        Index("idx_transacoes_subcat_date", "subcategory_id", "transaction_date"),
        Index("idx_transacoes_type_date", "type", "transaction_date"),
    )

    id = Column(Integer, primary_key=True, index=True)
    group_id = Column(String, nullable=False, default=lambda: str(uuid4()), index=True)
    amount = Column(Float, nullable=False)
    description = Column(String, nullable=False)
    installment_number = Column(Integer)
    total_installments = Column(Integer)
    is_installment = Column(Boolean, nullable=False, default=False, server_default="false")
    transaction_date = Column(DateTime, nullable=False)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    type = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    payment_method = Column(String, nullable=False)
    bank_code = Column(String, nullable=True)
    category_id = Column(Integer, ForeignKey("categorias.id"), nullable=False)
    subcategory_id = Column(Integer, ForeignKey("subcategorias.id"), nullable=False)
    recurring_account_id = Column(
        Integer, ForeignKey("recurring_accounts.id"), nullable=True, index=True
    )
    user_id = Column(
        Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )

    category = relationship("CategoryORM", lazy="joined")
    subcategory = relationship("SubcategoryORM", lazy="joined")
    recurring_account = relationship("RecurringAccountORM", lazy="selectin")
