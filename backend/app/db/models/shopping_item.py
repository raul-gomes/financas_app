from sqlalchemy import Column, Integer, String, Boolean, Date, DateTime, func
from app.db.base import Base


class ShoppingItemORM(Base):
    __tablename__ = 'shopping_items'

    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    mes_ref = Column(Date, nullable=False)
    marcado = Column(Boolean, default=False, nullable=False)
    data_conclusao = Column(Date, nullable=True)
    created_at = Column(DateTime, server_default=func.now())
