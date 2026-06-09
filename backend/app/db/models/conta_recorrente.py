from sqlalchemy import Column, Integer, Float, String, DateTime, Boolean, ForeignKey, func
from sqlalchemy.orm import relationship
from app.db.base import Base
from uuid import uuid4


class ContaRecorrenteORM(Base):
    __tablename__ = "contas_recorrentes"

    id = Column(Integer, primary_key=True, index=True)
    descricao = Column(String, nullable=False)
    valor = Column(Float, nullable=False)
    dia_vencimento = Column(Integer, nullable=False)
    categoria_id = Column(Integer, ForeignKey("categorias.id"), nullable=False)
    subcategoria_id = Column(Integer, ForeignKey("subcategorias.id"), nullable=False)
    natureza = Column(String, nullable=False)
    forma_pagamento = Column(String, nullable=False)
    data_inicio = Column(DateTime, nullable=False)
    data_fim = Column(DateTime, nullable=True)
    ativo = Column(Boolean, default=True, nullable=False)
    group_id = Column(String, default=lambda: str(uuid4()), nullable=False, index=True)
    total_parcelas = Column(Integer, default=12, nullable=False)

    categoria = relationship("CategoriaORM", lazy="joined")
    subcategoria = relationship("SubcategoriaORM", lazy="joined")

    @property
    def categoria_nome(self) -> str:
        return self.categoria.categoria_nome if self.categoria else ""

    @property
    def subcategoria_nome(self) -> str:
        return self.subcategoria.subcategoria_nome if self.subcategoria else ""
