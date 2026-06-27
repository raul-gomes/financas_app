# app/db/repositories/transacao.py

import calendar
import random
from typing import List, Optional
from datetime import date, datetime, time

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.core.database import get_session
from app.db.models.transacao import TransacaoORM
from app.db.repositories.categoria import CategoriaRepository
from app.db.repositories.subcategoria import SubcategoriaRepository
from app.schemas.transacao import TipoPagamento, TipoTransacao, TransacaoCreate, TransacaoUpdate
from app.schemas.categorias import CategoriaCreate
from app.schemas.subcategoria import SubcategoriaCreate
from app.logger import log_database_operation

from uuid import uuid4
from dateutil.relativedelta import relativedelta


class TransacaoRepository:
    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db
        self.categoria_repo = CategoriaRepository(db)
        self.subcategoria_repo = SubcategoriaRepository(db)

    def _calcular_valor_parcela(self, valor_total: float, total_parcelas: int) -> float:
        return round(valor_total / total_parcelas, 2)
    
    def _gerar_datas_parcelas(self, data_base: datetime, total_parcelas: int) -> List[datetime]:
        dates = []

        for i in range(total_parcelas):
            if i == 0:
                dates.append(data_base)
            else:
                mes_alvo = data_base + relativedelta(months=i)
                # Preserva o mesmo dia do mês da transação original
                # Se o dia não existir no mês alvo (ex: 31 em fevereiro), usa o último dia do mês
                ultimo_dia = calendar.monthrange(mes_alvo.year, mes_alvo.month)[1]
                dia = min(data_base.day, ultimo_dia)
                dates.append(mes_alvo.replace(day=dia))

        return dates
    
    def _create_transacaoes(
            self,
            obj_in,
            group_id: str,
            parcela: int,
            total_parcelas: int,
            valor: float,
            data_transacao: datetime,
            categoria_id=int,
            sub_id=int
    ) -> TransacaoORM:
        return TransacaoORM(
            group_id=group_id,
            tipo=obj_in.tipo,
            valor=valor,
            descricao=f'{obj_in.descricao} - parcela {parcela}/{total_parcelas}',
            data_transacao=data_transacao,
            forma_pagamento=obj_in.forma_pagamento,
            natureza=obj_in.natureza,
            parcela=parcela,  
            total_parcelas=total_parcelas,
            bank_code=obj_in.bank_code,
            categoria_id=categoria_id,
            subcategoria_id=sub_id,
        )
    
    def _ajustar_ultima_parcela(self, transacoes: List, valor: float):
        if not transacoes:
            return
        
        total_parcelas = sum(t.valor for t in transacoes)
        diferenca = round(valor - total_parcelas, 2)

        if diferenca != 0:
            transacoes[-1].valor = round(transacoes[-1].valor + diferenca, 2)
    
    async def _create_transacaoes_parceladas(self, 
                                      obj_in, 
                                      group_id: str, 
                                      categoria_id: int,
                                      sub_id: int
                                      ):
        total_parcelas = obj_in.total_parcelas
        valor = self._calcular_valor_parcela(obj_in.valor, total_parcelas)
        datas_parcelas = self._gerar_datas_parcelas(obj_in.data_transacao, total_parcelas)

        created_transactions = []

        for i in range(total_parcelas):
            transacao = self._create_transacaoes(
                obj_in=obj_in,
                group_id=group_id,
                parcela=i + 1,
                total_parcelas=total_parcelas,
                valor=valor,
                data_transacao=datas_parcelas[i],
                categoria_id=categoria_id,
                sub_id=sub_id
            )
            self.db.add(transacao)
            created_transactions.append(transacao)

        self._ajustar_ultima_parcela(created_transactions, obj_in.valor)

        await self.db.commit()

        for transacao in created_transactions:
            await self.db.refresh(transacao)

        return created_transactions

    async def create(self, obj_in: TransacaoCreate) -> TransacaoORM:
        log = log_database_operation(operation="create", collection="transacoes", payload=obj_in.model_dump())
        group_id = str(uuid4())

        # 1) Categoria: se id não informado, busca ou cria por nome
        if obj_in.categoria_id is not None:
            categoria = await self.categoria_repo.get_by_id(obj_in.categoria_id)
            if not categoria:
                raise HTTPException(status_code=400, detail="Categoria não encontrada")
        else:
            categoria = await self.categoria_repo.get_by_nome(obj_in.categoria_nome)
            if not categoria:
                categoria = await self.categoria_repo.create(
                    CategoriaCreate(
                        categoria_nome=obj_in.categoria_nome,
                        natureza=obj_in.natureza,
                        limite=0,
                        tipo=obj_in.tipo.value,
                        subcategorias=[]
                    )
                )

        # 2) Subcategoria: se id não informado, busca ou cria por nome sob a categoria
        if obj_in.subcategoria_id is not None:
            sub = await self.subcategoria_repo.get_by_id(obj_in.subcategoria_id)
            if not sub or sub.categoria_id != categoria.id:
                raise HTTPException(status_code=400, detail="Subcategoria inválida")
        else:
            sub = await self.subcategoria_repo.get_by_nome_and_categoria(
                obj_in.subcategoria_nome, categoria.id
            )
            if not sub:
                sub = await self.subcategoria_repo.create(
                    categoria_id=categoria.id,
                    obj_in=SubcategoriaCreate(subcategoria_nome=obj_in.subcategoria_nome)
                )

        # 3) Cria a transação usando os IDs resolvidos
        try:
            if (obj_in.total_parcelas is not None and obj_in.total_parcelas > 1):
                transacoes = await self._create_transacaoes_parceladas(obj_in, group_id, categoria.id, sub.id)
                log.info(f"Transação {group_id} criada, com {len(transacoes)} parcelas")
                return transacoes[0]
            else: 
                inst = TransacaoORM(
                    valor=obj_in.valor,
                    descricao=obj_in.descricao,
                    parcela=obj_in.parcela,
                    total_parcelas=obj_in.total_parcelas,
                    data_transacao=obj_in.data_transacao,
                    tipo=obj_in.tipo.value,
                    natureza=obj_in.natureza.value,
                    forma_pagamento=obj_in.forma_pagamento,
                    bank_code=obj_in.bank_code,
                    categoria_id=categoria.id,
                    subcategoria_id=sub.id,
                    group_id=group_id
                )

            self.db.add(inst)
            await self.db.commit()
            try:
                await self.db.refresh(inst)
            except Exception as refresh_err:
                log.error(f"Erro ao refresh transação: {refresh_err}")
                inst = await self.get_by_id(inst.id) or inst
            log.info(f"Transação {inst.id} criada")
            return inst
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Erro ao criar transação (integridade)")
        except Exception as e:
            await self.db.rollback()
            log.error(f"Erro inesperado ao criar transação: {type(e).__name__}: {e}", exc_info=True)
            raise

    async def get_all(
        self,
        data_inicio: Optional[datetime] = None,
        data_final: Optional[datetime] = None
    ) -> List[TransacaoORM]:
        stmt = select(TransacaoORM).options(
            selectinload(TransacaoORM.categoria),
            selectinload(TransacaoORM.subcategoria)
        )
        if data_inicio:
            stmt = stmt.where(TransacaoORM.data_transacao >= data_inicio)
        if data_final:
        # Ajusta para incluir toda a faixa do dia final
            data_final_completo = datetime.combine(data_final.date(), time.max)
            stmt = stmt.where(TransacaoORM.data_transacao <= data_final_completo)

        stmt = stmt.order_by(TransacaoORM.data_transacao.desc())
        result = await self.db.execute(stmt)
        return result.unique().scalars().all()

    async def get_by_id(self, id: int) -> Optional[TransacaoORM]:
        stmt = select(TransacaoORM).options(
            selectinload(TransacaoORM.categoria),
            selectinload(TransacaoORM.subcategoria)
        ).where(TransacaoORM.id == id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def update(self, id: int, obj_in: TransacaoUpdate) -> Optional[TransacaoORM]:
        trans = await self.get_by_id(id)
        if not trans:
            return None

        # 1) Se categoria_id ou categoria_nome vierem, resolve/cria
        resolved_categoria_id = None
        if obj_in.categoria_id is not None or obj_in.categoria_nome is not None:
            if obj_in.categoria_id is not None:
                categoria = await self.categoria_repo.get_by_id(obj_in.categoria_id)
                if not categoria:
                    raise HTTPException(status_code=400, detail="Categoria não encontrada")
            else:
                categoria = await self.categoria_repo.get_by_nome(obj_in.categoria_nome)
                if not categoria:
                    categoria = await self.categoria_repo.create(
                        CategoriaCreate(
                            categoria_nome=obj_in.categoria_nome,
                            natureza=obj_in.natureza or trans.natureza_transacao,
                            limite=0,
                            tipo=obj_in.tipo.value if obj_in.tipo else None,
                            subcategorias=[]
                        )
                    )
            resolved_categoria_id = categoria.id

        # 2) Se subcategoria_id ou subcategoria_nome vierem, resolve/cria
        if obj_in.subcategoria_id is not None or obj_in.subcategoria_nome is not None:
            cat_id_for_sub = resolved_categoria_id or trans.categoria_id
            if obj_in.subcategoria_id is not None:
                sub = await self.subcategoria_repo.get_by_id(obj_in.subcategoria_id)
                if not sub or sub.categoria_id != cat_id_for_sub:
                    raise HTTPException(status_code=400, detail="Subcategoria inválida")
            else:
                sub = await self.subcategoria_repo.get_by_nome_and_categoria(
                    obj_in.subcategoria_nome, cat_id_for_sub
                )
                if not sub:
                    sub = await self.subcategoria_repo.create(
                        categoria_id=cat_id_for_sub,
                        obj_in=SubcategoriaCreate(subcategoria_nome=obj_in.subcategoria_nome)
                    )
            trans.subcategoria_id = sub.id

        # Set categoria_id after all validations pass
        if resolved_categoria_id is not None:
            trans.categoria_id = resolved_categoria_id

        # 3) Atualiza demais campos
        data = obj_in.model_dump(exclude_unset=True, exclude={
            "categoria_id", "categoria_nome", "subcategoria_id", "subcategoria_nome"
        })
        for field, val in data.items():
            setattr(trans, field, val)

        try:
            await self.db.commit()
            await self.db.refresh(trans)
            return trans
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Erro ao atualizar transação")

    async def delete(self, id: int) -> Optional[TransacaoORM]:
        trans = await self.get_by_id(id)
        if not trans:
            return None
        await self.db.delete(trans)
        await self.db.commit()
        return trans

    async def check_duplicates(self, data_transacao: date, valor: float) -> List[TransacaoORM]:
        """Retorna transações existentes com a mesma data (ignorando hora) e valor."""
        from datetime import timedelta

        start = datetime.combine(data_transacao, time.min)
        end = datetime.combine(data_transacao, time.max)
        stmt = (
            select(TransacaoORM)
            .options(
                selectinload(TransacaoORM.categoria),
                selectinload(TransacaoORM.subcategoria)
            )
            .where(
                TransacaoORM.data_transacao >= start,
                TransacaoORM.data_transacao <= end,
                TransacaoORM.valor == valor,
            )
        )
        result = await self.db.execute(stmt)
        return list(result.unique().scalars().all())

    async def assign_random_banks(self, bank_codes: List[str]) -> int:
        """Atribui um bank_code aleatório às transações sem bank_code."""
        from sqlalchemy import update as sql_update

        result = await self.db.execute(
            select(TransacaoORM).where(TransacaoORM.bank_code.is_(None))
        )
        transacoes = result.unique().scalars().all()

        for t in transacoes:
            t.bank_code = random.choice(bank_codes)

        await self.db.commit()
        return len(transacoes)

    async def create_from_extracto(
        self,
        valor: float,
        descricao: str,
        data_transacao: datetime,
        tipo: str,
        natureza: str,
        forma_pagamento: str,
        categoria_id: Optional[int] = None,
        subcategoria_id: Optional[int] = None,
        categoria_nome: Optional[str] = None,
        subcategoria_nome: Optional[str] = None,
        bank_code: Optional[str] = None,
        total_parcelas: Optional[int] = None,
    ) -> TransacaoORM:
        group_id = str(uuid4())

        # 1) Resolve categoria: by ID or by nome (cria se não existir)
        if categoria_id is not None:
            cat = await self.categoria_repo.get_by_id(categoria_id)
            if not cat:
                raise HTTPException(status_code=400, detail="Categoria não encontrada")
        elif categoria_nome is not None:
            cat = await self.categoria_repo.get_by_nome(categoria_nome)
            if not cat:
                cat = await self.categoria_repo.create(
                    CategoriaCreate(
                        categoria_nome=categoria_nome,
                        natureza=natureza,
                        limite=0,
                        tipo=tipo,
                        subcategorias=[],
                    )
                )
        else:
            raise HTTPException(status_code=400, detail="categoria_id or categoria_nome is required")

        # 2) Resolve subcategoria: by ID or by nome (cria se não existir)
        sub = None
        if subcategoria_id is not None:
            sub = await self.subcategoria_repo.get_by_id(subcategoria_id)
            if not sub or sub.categoria_id != cat.id:
                raise HTTPException(status_code=400, detail="Subcategoria inválida")
        elif subcategoria_nome is not None:
            sub = await self.subcategoria_repo.get_by_nome_and_categoria(
                subcategoria_nome, cat.id
            )
            if not sub:
                sub = await self.subcategoria_repo.create(
                    categoria_id=cat.id,
                    obj_in=SubcategoriaCreate(subcategoria_nome=subcategoria_nome),
                )

        # 3) Cria transação(ões) — com parcelamento se solicitado
        if total_parcelas is not None and total_parcelas > 1:
            valor_parcela = self._calcular_valor_parcela(valor, total_parcelas)
            datas = self._gerar_datas_parcelas(data_transacao, total_parcelas)
            transacoes = []
            for i in range(total_parcelas):
                inst = TransacaoORM(
                    valor=valor_parcela,
                    descricao=f'{descricao} - parcela {i + 1}/{total_parcelas}',
                    parcela=i + 1,
                    total_parcelas=total_parcelas,
                    data_transacao=datas[i],
                    tipo=tipo,
                    natureza=natureza,
                    forma_pagamento=forma_pagamento,
                    categoria_id=cat.id,
                    subcategoria_id=sub.id if sub else None,
                    bank_code=bank_code,
                    group_id=group_id,
                )
                self.db.add(inst)
                transacoes.append(inst)
            self._ajustar_ultima_parcela(transacoes, valor)
            await self.db.commit()
            for inst in transacoes:
                await self.db.refresh(inst)
            return transacoes[0]
        else:
            inst = TransacaoORM(
                valor=valor,
                descricao=descricao,
                parcela=1,
                total_parcelas=1,
                data_transacao=data_transacao,
                tipo=tipo,
                natureza=natureza,
                forma_pagamento=forma_pagamento,
                categoria_id=cat.id,
                subcategoria_id=sub.id if sub else None,
                bank_code=bank_code,
                group_id=group_id,
            )
            self.db.add(inst)
            await self.db.commit()
            await self.db.refresh(inst)
            return inst
