from sqlalchemy import Column, Integer, String, Float, Boolean, Date, ForeignKey
from sqlalchemy.orm import relationship
from app.db.base import Base

class CategoriaORM(Base):
    __tablename__ = 'categorias'

    id = Column(Integer, primary_key=True, index=True)
    categoria_nome = Column(String, unique=True, nullable=False)
    natureza = Column(String, nullable=False)
    limite = Column(Float, default=0)
    tipo = Column(String, nullable=True)  # 'entrada', 'saida', 'investimento' ou None (especiais)
    
    subcategorias = relationship(
        'SubcategoriaORM',
        back_populates='categoria',
        cascade='all, delete-orphan',
        lazy='joined'
    )


class SubcategoriaORM(Base):
    __tablename__ = 'subcategorias'

    id = Column(Integer, primary_key=True, index=True)
    subcategoria_nome = Column(String, nullable=False)
    categoria_id = Column(
        Integer, 
        ForeignKey('categorias.id', ondelete='CASCADE')
        )
    valor_alvo = Column(Float, nullable=True, default=None)
    concluida = Column(Boolean, default=False, nullable=False)
    data_conclusao = Column(Date, nullable=True)

    categoria = relationship(
        'CategoriaORM', 
        back_populates='subcategorias',
        lazy='joined'
        )