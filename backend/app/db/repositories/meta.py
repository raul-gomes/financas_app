# app/db/repositories/meta.py

from typing import List, Optional
from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from datetime import date

from app.core.database import get_session
from app.db.models.categoria import CategoriaORM, SubcategoriaORM
from app.db.models.transacao import TransacaoORM
from app.schemas.metas import MetaCreate, MetaUpdate
from app.logger import log_database_operation


METAS_CATEGORIA_NOME = "Metas"


class MetaRepository:
    """
    Repositório para operações com Metas.
    Metas são subcategorias com valor_alvo preenchido, agrupadas sob a categoria "Metas".
    """

    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db
        self.model = SubcategoriaORM

    async def _get_or_create_metas_categoria(self) -> CategoriaORM:
        """Retorna a categoria 'Metas', criando se não existir."""
        result = await self.db.execute(
            select(CategoriaORM)
            .options(selectinload(CategoriaORM.subcategorias))
            .where(CategoriaORM.categoria_nome == METAS_CATEGORIA_NOME)
        )
        categoria = result.scalars().first()
        if not categoria:
            categoria = CategoriaORM(
                categoria_nome=METAS_CATEGORIA_NOME,
                natureza="pf",
                tipo=None,
                limite=0,
            )
            self.db.add(categoria)
            await self.db.commit()
            await self.db.refresh(categoria)
        return categoria

    async def list_metas(self, concluida: Optional[bool] = None) -> List[SubcategoriaORM]:
        """Lista todas as subcategorias que são metas (possuem valor_alvo).
        
        Args:
            concluida: Se True, retorna apenas concluídas. Se False, apenas ativas. Se None, todas.
        """
        log = log_database_operation(operation="read_all", collection="metas")
        query = (
            select(self.model)
            .options(selectinload(self.model.categoria))
            .where(self.model.valor_alvo.isnot(None))
        )
        if concluida is not None:
            query = query.where(self.model.concluida == concluida)
        query = query.order_by(self.model.subcategoria_nome)

        result = await self.db.execute(query)
        metas = result.unique().scalars().all()
        log.info(f"{len(metas)} metas encontradas")
        return metas

    async def create_meta(self, obj_in: MetaCreate) -> SubcategoriaORM:
        """Cria uma nova meta (subcategoria com valor_alvo na categoria Metas)."""
        log = log_database_operation(operation="create", collection="metas", payload=obj_in.model_dump())
        categoria = await self._get_or_create_metas_categoria()

        # Verifica se já existe subcategoria com mesmo nome
        existente = await self.db.execute(
            select(self.model).where(
                self.model.subcategoria_nome == obj_in.subcategoria_nome,
                self.model.categoria_id == categoria.id
            )
        )
        if existente.scalars().first():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Meta com nome '{obj_in.subcategoria_nome}' já existe"
            )

        meta = self.model(
            subcategoria_nome=obj_in.subcategoria_nome,
            categoria_id=categoria.id,
            valor_alvo=obj_in.valor_alvo,
        )
        self.db.add(meta)
        await self.db.commit()
        await self.db.refresh(meta)
        log.info(f"Meta {meta.id} criada: {meta.subcategoria_nome}")
        return meta

    async def update_meta(self, meta_id: int, obj_in: MetaUpdate) -> Optional[SubcategoriaORM]:
        """Atualiza uma meta existente."""
        log = log_database_operation(operation="update", collection="metas", meta_id=meta_id)
        meta = await self.db.get(self.model, meta_id)
        if not meta or meta.valor_alvo is None:
            log.warning(f"Meta {meta_id} não encontrada")
            return None

        update_data = obj_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(meta, field, value)
        await self.db.commit()
        await self.db.refresh(meta)
        log.info(f"Meta {meta_id} atualizada")
        return meta

    async def delete_meta(self, meta_id: int) -> Optional[SubcategoriaORM]:
        """Remove uma meta (deleta a subcategoria)."""
        log = log_database_operation(operation="delete", collection="metas", meta_id=meta_id)
        meta = await self.db.get(self.model, meta_id)
        if not meta or meta.valor_alvo is None:
            log.warning(f"Meta {meta_id} não encontrada")
            return None

        await self.db.delete(meta)
        await self.db.commit()
        log.info(f"Meta {meta_id} excluída")
        return meta

    async def concluir_meta(self, meta_id: int) -> Optional[SubcategoriaORM]:
        """Marca uma meta como concluída com a data atual."""
        log = log_database_operation(operation="concluir", collection="metas", meta_id=meta_id)
        meta = await self.db.get(self.model, meta_id)
        if not meta or meta.valor_alvo is None:
            log.warning(f"Meta {meta_id} não encontrada")
            return None
        meta.concluida = True
        meta.data_conclusao = date.today()
        await self.db.commit()
        await self.db.refresh(meta)
        log.info(f"Meta {meta_id} concluída em {meta.data_conclusao}")
        return meta

    async def reativar_meta(self, meta_id: int) -> Optional[SubcategoriaORM]:
        """Reativa uma meta concluída."""
        log = log_database_operation(operation="reativar", collection="metas", meta_id=meta_id)
        meta = await self.db.get(self.model, meta_id)
        if not meta or meta.valor_alvo is None:
            log.warning(f"Meta {meta_id} não encontrada")
            return None
        meta.concluida = False
        meta.data_conclusao = None
        await self.db.commit()
        await self.db.refresh(meta)
        log.info(f"Meta {meta_id} reativada")
        return meta

    async def calcular_progresso(
        self, meta_id: int, ano: int, mes: int
    ) -> Optional[dict]:
        """Calcula o progresso de uma meta específica em um determinado mês."""
        meta = await self.db.get(self.model, meta_id)
        if not meta or meta.valor_alvo is None:
            return None

        # Soma das transações da subcategoria no mês
        result = await self.db.execute(
            select(func.coalesce(func.sum(TransacaoORM.valor), 0))
            .where(
                and_(
                    TransacaoORM.subcategoria_id == meta_id,
                    func.extract('year', TransacaoORM.data_transacao) == ano,
                    func.extract('month', TransacaoORM.data_transacao) == mes,
                )
            )
        )
        valor_atual = result.scalar() or 0.0
        progresso = (valor_atual / meta.valor_alvo * 100) if meta.valor_alvo > 0 else 0.0

        return {
            "subcategoria_id": meta.id,
            "subcategoria_nome": meta.subcategoria_nome,
            "valor_alvo": meta.valor_alvo,
            "valor_atual": round(valor_atual, 2),
            "progresso": round(progresso, 1),
            "concluida": meta.concluida,
            "data_conclusao": meta.data_conclusao,
        }

    async def calcular_progresso_todas(self, ano: int, mes: int, concluida: Optional[bool] = None) -> List[dict]:
        """Calcula o progresso de todas as metas no mês informado.
        
        Args:
            ano: Ano para calcular progresso
            mes: Mês para calcular progresso
            concluida: Se True, apenas concluídas. Se False, apenas ativas. Se None, todas.
        """
        metas = await self.list_metas(concluida=concluida)
        resultados = []
        for meta in metas:
            progresso = await self.calcular_progresso(meta.id, ano, mes)
            if progresso:
                resultados.append(progresso)
        return resultados
