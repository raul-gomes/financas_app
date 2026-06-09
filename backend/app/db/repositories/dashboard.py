# app/db/repositories/dashboard.py

import calendar
from typing import List, Dict, Any, Optional
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.db.models.transacao import TransacaoORM
from app.db.models.categoria import CategoriaORM
from app.schemas.dashboard import CategoriaOpcao, EntradasPorCategoriaResponse, ExtratoResponse, OpcoesCategoriaResponse, RendimentoPeriodoResponse, SubcategoriaOpcao, TipoTrans, TransacaoExtrato
from app.schemas.transacao import NaturezaTransacao, TransacaoResponse

class DashboardRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def gastos_por_categoria(
        self,
        data_inicio: datetime,
        data_final: datetime,
        natureza: str,
        tipo: TipoTrans,
    ) -> List[Dict[str, Any]]:
        stmt = (
            select(TransacaoORM)
            .where(TransacaoORM.data_transacao >= data_inicio)
            .where(TransacaoORM.data_transacao <= data_final)
        )
        if natureza != 'all':
            stmt = stmt.where(TransacaoORM.natureza == NaturezaTransacao(natureza))
        stmt = stmt.where(TransacaoORM.tipo == tipo.value).options(
            selectinload(TransacaoORM.categoria),
            selectinload(TransacaoORM.subcategoria),
        )

        result = await self.db.execute(stmt)
        transacoes = result.unique().scalars().all()

        gastos: Dict[int, Dict[str, Any]] = {}
        for t in transacoes:
            if not t.categoria or not t.subcategoria:
                continue
            cid = t.categoria.id
            cat_nome = t.categoria.categoria_nome
            sub_nome = t.subcategoria.subcategoria_nome
            limite = t.categoria.limite

            cat = gastos.setdefault(
                cid,
                {"nome": cat_nome, "total": 0.0, "limite": limite, "subcategorias": {}},
            )
            cat["total"] += t.valor
            cat["subcategorias"].setdefault(sub_nome, 0.0)
            cat["subcategorias"][sub_nome] += t.valor

        resultado = []
        for data in gastos.values():
            if data["total"] > 0:
                resultado.append(
                    {
                        "nome": data["nome"],
                        "total": round(data["total"], 2),
                        "limite": data["limite"],
                        "subcategorias": [
                            {"nome": sn, "valor": f"{round(v,2):.2f}"}
                            for sn, v in data["subcategorias"].items()
                        ],
                    }
                )

        return resultado

    async def rendimento_por_periodo(
        self, 
        ano: int,
        natureza: str) -> Dict[str, Dict[str, float]]:

        meses_data: Dict[str, Dict[str, float]] = {}

        for m in range(1, 13):
            first = datetime(ano, m, 1)
            last_day = calendar.monthrange(ano, m)[1]
            last = datetime(ano, m, last_day, 23, 59, 59)

            stmt = (
                select(TransacaoORM)
                .where(TransacaoORM.data_transacao >= first)
                .where(TransacaoORM.data_transacao <= last)
            )
            if natureza != 'all':
                stmt = stmt.where(TransacaoORM.natureza == natureza)

            result = await self.db.execute(stmt)
            transacoes = result.unique().scalars().all()

            entradas = sum(t.valor for t in transacoes if t.tipo == "entrada")
            saidas = sum(t.valor for t in transacoes if t.tipo == "saida")

            meses_data[calendar.month_name[m].lower()] = {
                "entrada": round(entradas, 2),
                "saida": round(saidas, 2),
            }

        mensal_cat = await self.db.execute(
            select(CategoriaORM)
            .where(func.lower(CategoriaORM.categoria_nome) == 'mensal pf')
            .where(CategoriaORM.natureza == 'pf')
        )
        mensal_pf_obj = mensal_cat.scalars().first()

        mensal_pj_cat = await self.db.execute(
            select(CategoriaORM)
            .where(func.lower(CategoriaORM.categoria_nome) == 'mensal pj')
            .where(CategoriaORM.natureza == 'pj')
        )
        mensal_pj_obj = mensal_pj_cat.scalars().first()

        if natureza == 'pf':
            limite_mensal = mensal_pf_obj.limite if mensal_pf_obj else 1000.0
        elif natureza == 'pj':
            limite_mensal = mensal_pj_obj.limite if mensal_pj_obj else 1000.0
        else:
            limite_mensal = max(
                (mensal_pf_obj.limite if mensal_pf_obj else 0),
                (mensal_pj_obj.limite if mensal_pj_obj else 0)
            )
            if limite_mensal == 0:
                limite_mensal = 1000.0

        return RendimentoPeriodoResponse(limite=limite_mensal, meses=meses_data)
    
    async def extrato_financeiro(
        self,
        data_inicio: datetime,
        data_final: datetime,
        natureza: str,
        data_inicio_str: str,
        data_final_str: str
    ) -> ExtratoResponse:
        stmt = (
            select(TransacaoORM)
            .where(TransacaoORM.data_transacao >= data_inicio)
            .where(TransacaoORM.data_transacao <= data_final)
        )
        if natureza != 'all':
            stmt = stmt.where(TransacaoORM.natureza == natureza)
        stmt = stmt.options(
            selectinload(TransacaoORM.categoria),
            selectinload(TransacaoORM.subcategoria),
            selectinload(TransacaoORM.conta_recorrente),
        ).order_by(TransacaoORM.data_transacao.desc())
        result = await self.db.execute(stmt)
        transacoes = result.unique().scalars().all()
    
        entradas = sum(t.valor for t in transacoes if t.tipo == "entrada")
        saidas = sum(t.valor for t in transacoes if t.tipo == "saida")
    
        txs = [
            TransacaoExtrato(
                id=t.id,
                tipo=t.tipo,
                valor=t.valor,
                descricao=t.descricao,
                categoria_id=t.categoria_id,
                subcategoria_id=t.subcategoria_id,
                categoria_nome=t.categoria.categoria_nome if t.categoria else "",
                subcategoria_nome=t.subcategoria.subcategoria_nome if t.subcategoria else "",
                forma_pagamento=t.forma_pagamento,
                parcela=t.parcela,
                total_parcelas=t.total_parcelas,
                natureza=t.natureza,
                data_transacao=t.data_transacao,
                conta_recorrente_id=t.conta_recorrente_id,
            )
            for t in transacoes
        ]

        # Gastos fixos (com conta_recorrente_id) vs variáveis
        gastos_fixos = sum(t.valor for t in transacoes if t.tipo == "saida" and t.conta_recorrente_id is not None)
        gastos_variaveis = sum(t.valor for t in transacoes if t.tipo == "saida" and t.conta_recorrente_id is None)

        # Helper to read category limit by name
        async def _get_cat_limit(cat_name: str, default: float = 1000.0) -> float:
            result = await self.db.execute(
                select(CategoriaORM)
                .where(func.lower(CategoriaORM.categoria_nome) == cat_name.lower())
            )
            obj = result.scalars().first()
            return obj.limite if obj else default

        # Meta mensal por natureza
        if natureza == 'pf':
            limite_mensal = await _get_cat_limit('Mensal PF')
        elif natureza == 'pj':
            limite_mensal = await _get_cat_limit('Mensal PJ')
        else:
            limite_mensal = max(
                await _get_cat_limit('Mensal PF', 0),
                await _get_cat_limit('Mensal PJ', 0)
            )
            if limite_mensal == 0:
                limite_mensal = 1000.0

        limite_cartao = await _get_cat_limit('Limite Cartao Credito', 0)

        return ExtratoResponse(
            entradas=entradas,
            saidas=saidas,
            data_inicial=data_inicio_str,
            data_final=data_final_str,
            meta_mensal=limite_mensal,
            total_investido=entradas,
            transacoes=txs,
            limite_cartao_credito=limite_cartao,
            gastos_fixos=gastos_fixos,
            gastos_variaveis=gastos_variaveis,
        )

    async def opcoes_categorias(self, natureza: str = 'all', tipo: Optional[str] = None) -> OpcoesCategoriaResponse:
        stmt = select(CategoriaORM).options(
            selectinload(CategoriaORM.subcategorias)
        )
        if natureza != 'all':
            stmt = stmt.where(CategoriaORM.natureza == NaturezaTransacao(natureza))
        if tipo:
            stmt = stmt.where(CategoriaORM.tipo == tipo)
        result = await self.db.execute(stmt)
        categorias = result.unique().scalars().all()

        opcoes: List[CategoriaOpcao] = []
        for categoria in categorias:
            subs = [
                SubcategoriaOpcao(
                    id=sub.id,
                    nome=sub.subcategoria_nome
                )
                for sub in categoria.subcategorias
            ]
            opcoes.append(
                CategoriaOpcao(
                    id=categoria.id,
                    categoria=categoria.categoria_nome,
                    tipo=categoria.tipo,
                    subcategorias=subs
                )
            )

        return OpcoesCategoriaResponse(opcoes=opcoes)

    async def entradas_por_categoria(
        self, 
        data_inicio: datetime, 
        data_final: datetime, 
        natureza: str,
        data_inicio_str: str,
        data_final_str: str
    ) -> EntradasPorCategoriaResponse:
        
        # Buscar todas as categorias
        stmt_categorias = select(CategoriaORM)
        result = await self.db.execute(stmt_categorias)
        categorias = result.unique().scalars().all()
        
        output: List[Dict[str, Any]] = []
        
        for categoria in categorias:
            # Buscar transações de entrada para esta categoria
            stmt_transacoes = (
                select(TransacaoORM)
                .where(TransacaoORM.data_transacao >= data_inicio)
                .where(TransacaoORM.data_transacao <= data_final)
            )
            if natureza != 'all':
                stmt_transacoes = stmt_transacoes.where(TransacaoORM.natureza == natureza)
            stmt_transacoes = (
                stmt_transacoes
                .where(TransacaoORM.categoria_id == categoria.id)
                .where(TransacaoORM.tipo == "entrada")
                .options(selectinload(TransacaoORM.subcategoria))
            )
            
            result_trans = await self.db.execute(stmt_transacoes)
            transacoes = result_trans.unique().scalars().all()
            
            subs: Dict[str, float] = {}
            total = 0.0
            
            for transacao in transacoes:
                valor = transacao.valor
                total += valor
                
                if transacao.subcategoria:
                    sub_nome = transacao.subcategoria.subcategoria_nome
                    subs.setdefault(sub_nome, 0.0)
                    subs[sub_nome] += valor
            
            # Só adiciona se tiver algum valor
            if total > 0:
                categoria_data = {
                    'total': round(total, 2),
                    categoria.categoria_nome.lower(): {k: round(v, 2) for k, v in subs.items()}
                }
                output.append(categoria_data)
        
        return EntradasPorCategoriaResponse(
            data_inicial=data_inicio_str,
            data_final=data_final_str,
            subcategorias=output
        )

