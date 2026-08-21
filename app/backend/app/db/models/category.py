from sqlalchemy import Column, Integer, String, Float, Boolean, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from app.db.base import Base

class CategoryORM(Base):
    __tablename__ = 'categorias'
    # Alinhado com a migração dfc6bf881c13: unicidade por nome DENTRO de cada natureza
    __table_args__ = (
        UniqueConstraint('name', 'entity_type', name='uq_categorias_name_entity_type'),
    )

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    limit = Column(Float, default=0)
    type = Column(String, nullable=True)  # 'income', 'expense', 'investment' or None (special)
    
    subcategories = relationship(
        'SubcategoryORM',
        back_populates='category',
        cascade='all, delete-orphan',
        lazy='joined'
    )


class SubcategoryORM(Base):
    __tablename__ = 'subcategorias'

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    category_id = Column(
        Integer, 
        ForeignKey('categorias.id', ondelete='CASCADE')
        )
    target_amount = Column(Float, nullable=True, default=None)
    completed = Column(Boolean, default=False, nullable=False)
    completed_at = Column(Date, nullable=True)

    category = relationship(
        'CategoryORM', 
        back_populates='subcategories',
        lazy='joined'
        )