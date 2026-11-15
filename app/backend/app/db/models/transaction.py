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
    text,
)
from sqlalchemy.orm import relationship

from app.db.base import Base

EXTERNAL_ID_MAX_LENGTH = 64
EXTERNAL_SOURCE_MAX_LENGTH = 16


class TransactionORM(Base):
    __tablename__ = "transacoes"
    __table_args__ = (
        Index("idx_transacoes_cat_date", "category_id", "transaction_date"),
        Index("idx_transacoes_entity_date", "entity_type", "transaction_date"),
        Index("idx_transacoes_recurring", "recurring_account_id", "transaction_date"),
        Index("idx_transacoes_subcat_date", "subcategory_id", "transaction_date"),
        Index("idx_transacoes_type_date", "type", "transaction_date"),
        # Provider dedupe: one row per (user, source, provider id); manual rows have no id.
        Index(
            "uq_transacoes_user_external",
            "user_id",
            "external_source",
            "external_id",
            unique=True,
            postgresql_where=text("external_id IS NOT NULL"),
            sqlite_where=text("external_id IS NOT NULL"),
        ),
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
    # Provider transaction id (e.g. Pluggy) and its source; NULL for manual/extract rows.
    external_id = Column(String(EXTERNAL_ID_MAX_LENGTH), nullable=True)
    external_source = Column(String(EXTERNAL_SOURCE_MAX_LENGTH), nullable=True)
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
    # Not read by any response; repositories that need it add an explicit selectinload.
    recurring_account = relationship("RecurringAccountORM", lazy="select")
