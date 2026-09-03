from sqlalchemy import Column, Integer, Float, String, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base
from uuid import uuid4


class RecurringAccountORM(Base):
    __tablename__ = "recurring_accounts"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    description = Column(String, nullable=False)
    amount = Column(Float, nullable=False)
    due_day = Column(Integer, nullable=False)
    category_id = Column(Integer, ForeignKey("categorias.id"), nullable=False)
    subcategory_id = Column(Integer, ForeignKey("subcategorias.id"), nullable=False)
    entity_type = Column(String, nullable=False)
    payment_method = Column(String, nullable=False)
    bank_code = Column(String, nullable=True)
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)
    active = Column(Boolean, default=True, nullable=False)
    group_id = Column(String, default=lambda: str(uuid4()), nullable=False, index=True)
    total_installments = Column(Integer, default=12, nullable=False)

    category = relationship("CategoryORM", lazy="joined")
    subcategory = relationship("SubcategoryORM", lazy="joined")

    @property
    def category_name(self) -> str:
        return self.category.name if self.category else ""

    @property
    def subcategory_name(self) -> str:
        return self.subcategory.name if self.subcategory else ""
