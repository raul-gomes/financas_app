from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, func
from app.db.base import Base


class ShoppingItemORM(Base):
    __tablename__ = 'shopping_items'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    reference_month = Column(Date, nullable=False)
    checked = Column(Boolean, default=False, nullable=False)
    completed_at = Column(Date, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    entity_type = Column(String, nullable=False, server_default='individual')
