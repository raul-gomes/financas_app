# app/db/repositories/transacao.py

import calendar
import random
from typing import List, Optional, Dict
from datetime import date, datetime, time

from fastapi import Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import selectinload

from app.core.database import get_session
from app.db.models.transaction import TransactionORM
from app.db.repositories.category import CategoriaRepository
from app.db.repositories.subcategory import SubcategoriaRepository
from app.schemas.transaction import TipoPagamento, TipoTransacao, TransacaoCreate, TransacaoUpdate
from app.schemas.categories import CategoriaCreate
from app.schemas.subcategory import SubcategoriaCreate
from app.logger import log_database_operation

from uuid import uuid4
from dateutil.relativedelta import relativedelta


class TransacaoRepository:
    def __init__(self, db: AsyncSession = Depends(get_session)):
        self.db = db
        self.categoria_repo = CategoriaRepository(db)
        self.subcategoria_repo = SubcategoriaRepository(db)

    def _calculate_installment_amount(self, total_amount: float, total_installments: int) -> float:
        return round(total_amount / total_installments, 2)
    
    def _generate_installment_dates(self, base_date: datetime, total_installments: int) -> List[datetime]:
        dates = []

        for i in range(total_installments):
            if i == 0:
                dates.append(base_date)
            else:
                mes_alvo = base_date + relativedelta(months=i)
                # Preserva o mesmo dia do mês da transação original
                # Se o dia não existir no mês alvo (ex: 31 em fevereiro), usa o último dia do mês
                ultimo_dia = calendar.monthrange(mes_alvo.year, mes_alvo.month)[1]
                dia = min(base_date.day, ultimo_dia)
                dates.append(mes_alvo.replace(day=dia))

        return dates
    
    def _create_transactions(
            self,
            obj_in,
            group_id: str,
            installment_number: int,
            total_installments: int,
            amount: float,
            transaction_date: datetime,
            category_id=int,
            sub_id=int,
            user_id: int = None,
    ) -> TransactionORM:
        return TransactionORM(
            group_id=group_id,
            type=obj_in.type,
            amount=amount,
            description=f'{obj_in.description} - parcela {installment_number}/{total_installments}',
            transaction_date=transaction_date,
            payment_method=obj_in.payment_method,
            entity_type=obj_in.entity_type,
            installment_number=installment_number,  
            total_installments=total_installments,
            is_installment=True,
            bank_code=obj_in.bank_code,
            category_id=category_id,
            subcategory_id=sub_id,
            user_id=user_id,
        )
    
    def _adjust_last_installment(self, transactions: List, amount: float):
        if not transactions:
            return
        
        total_parcelas = sum(t.amount for t in transactions)
        diferenca = round(amount - total_parcelas, 2)

        if diferenca != 0:
            transactions[-1].amount = round(transactions[-1].amount + diferenca, 2)
    
    async def _create_installment_transactions(self, 
                                      obj_in, 
                                      group_id: str, 
                                      category_id: int,
                                      sub_id: int,
                                      user_id: int = None,
                                      ):
        total_installments = obj_in.total_installments
        amount = self._calculate_installment_amount(obj_in.amount, total_installments)
        installment_dates = self._generate_installment_dates(obj_in.transaction_date, total_installments)

        created_transactions = []

        for i in range(total_installments):
            transacao = self._create_transactions(
                obj_in=obj_in,
                group_id=group_id,
                installment_number=i + 1,
                total_installments=total_installments,
                amount=amount,
                transaction_date=installment_dates[i],
                category_id=category_id,
                sub_id=sub_id,
                user_id=user_id,
            )
            self.db.add(transacao)
            created_transactions.append(transacao)

        self._adjust_last_installment(created_transactions, obj_in.amount)

        await self.db.commit()

        for transacao in created_transactions:
            await self.db.refresh(transacao)

        return created_transactions

    async def create(self, obj_in: TransacaoCreate, user_id: int) -> TransactionORM:
        log = log_database_operation(operation="create", collection="transacoes", payload=obj_in.model_dump(), user_id=user_id)
        group_id = str(uuid4())

        # 1) Categoria: se id não informado, busca ou cria por nome
        if obj_in.category_id is not None:
            categoria = await self.categoria_repo.get_by_id(obj_in.category_id, user_id)
            if not categoria:
                raise HTTPException(status_code=400, detail="Categoria não encontrada")
        else:
            categoria = await self.categoria_repo.get_by_nome(obj_in.category_name, user_id)
            if not categoria:
                # Cria a categoria com o nome exato enviado e tipo = tipo da transação
                categoria = await self.categoria_repo.create(
                    user_id,
                    CategoriaCreate(
                        category_name=obj_in.category_name,
                        entity_type=obj_in.entity_type,
                        limit=0,
                        type=obj_in.type.value,
                        subcategories=[]
                    )
                )

        # 2) Subcategoria: se id não informado, busca ou cria por nome sob a categoria
        if obj_in.subcategory_id is not None:
            sub = await self.subcategoria_repo.get_by_id(obj_in.subcategory_id, user_id)
            if not sub or sub.category_id != categoria.id:
                raise HTTPException(status_code=400, detail="Subcategoria inválida")
        else:
            sub = await self.subcategoria_repo.get_by_nome_and_categoria(
                obj_in.subcategory_name, categoria.id, user_id
            )
            if not sub:
                sub = await self.subcategoria_repo.create(
                    categoria_id=categoria.id,
                    user_id=user_id,
                    obj_in=SubcategoriaCreate(subcategory_name=obj_in.subcategory_name)
                )

        # 3) Cria a transação usando os IDs resolvidos
        try:
            if (obj_in.total_installments is not None and obj_in.total_installments > 1):
                transacoes = await self._create_installment_transactions(obj_in, group_id, categoria.id, sub.id, user_id)
                log.info(f"Transação {group_id} criada, com {len(transacoes)} parcelas")
                return transacoes[0]
            else: 
                inst = TransactionORM(
                    amount=obj_in.amount,
                    description=obj_in.description,
                    installment_number=obj_in.installment_number,
                    total_installments=obj_in.total_installments,
                    is_installment=obj_in.is_installment,
                    transaction_date=obj_in.transaction_date,
                    type=obj_in.type.value,
                    entity_type=obj_in.entity_type.value,
                    payment_method=obj_in.payment_method,
                    bank_code=obj_in.bank_code,
                    category_id=categoria.id,
                    subcategory_id=sub.id,
                    group_id=group_id,
                    user_id=user_id,
                )

            self.db.add(inst)
            await self.db.commit()
            try:
                await self.db.refresh(inst)
            except Exception as refresh_err:
                log.error(f"Erro ao refresh transação: {refresh_err}")
                inst = await self.get_by_id(inst.id, user_id) or inst
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
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        limit: int = 100,
        offset: int = 0,
        user_id: Optional[int] = None,
    ) -> List[TransactionORM]:
        stmt = select(TransactionORM).options(
            selectinload(TransactionORM.recurring_account)
        )
        if user_id is not None:
            stmt = stmt.where(TransactionORM.user_id == user_id)
        if start_date:
            stmt = stmt.where(TransactionORM.transaction_date >= start_date)
        if end_date:
        # Ajusta para incluir toda a faixa do dia final
            data_final_completo = datetime.combine(end_date.date(), time.max)
            stmt = stmt.where(TransactionORM.transaction_date <= data_final_completo)

        stmt = stmt.order_by(TransactionORM.transaction_date.desc()).limit(limit).offset(offset)
        result = await self.db.execute(stmt)
        return result.unique().scalars().all()

    async def get_by_id(self, id: int, user_id: Optional[int] = None) -> Optional[TransactionORM]:
        stmt = select(TransactionORM).options(
            selectinload(TransactionORM.recurring_account)
        ).where(TransactionORM.id == id)
        if user_id is not None:
            stmt = stmt.where(TransactionORM.user_id == user_id)
        result = await self.db.execute(stmt)
        return result.scalars().first()

    async def update(self, id: int, obj_in: TransacaoUpdate, user_id: int) -> Optional[TransactionORM]:
        trans = await self.get_by_id(id, user_id)
        if not trans:
            return None

        # 1) Se category_id ou category_name vierem, resolve/cria
        resolved_category_id = None
        if obj_in.category_id is not None or obj_in.category_name is not None:
            if obj_in.category_id is not None:
                categoria = await self.categoria_repo.get_by_id(obj_in.category_id, user_id)
                if not categoria:
                    raise HTTPException(status_code=400, detail="Categoria não encontrada")
            else:
                categoria = await self.categoria_repo.get_by_nome(obj_in.category_name, user_id)
                if not categoria:
                    categoria = await self.categoria_repo.create(
                        user_id,
                        CategoriaCreate(
                            category_name=obj_in.category_name,
                            entity_type=obj_in.entity_type or trans.entity_type,
                            limit=0,
                            type=obj_in.type.value if obj_in.type else None,
                            subcategories=[]
                        )
                    )
            resolved_category_id = categoria.id

        # 2) Se subcategory_id ou subcategory_name vierem, resolve/cria
        if obj_in.subcategory_id is not None or obj_in.subcategory_name is not None:
            cat_id_for_sub = resolved_category_id or trans.category_id
            if obj_in.subcategory_id is not None:
                sub = await self.subcategoria_repo.get_by_id(obj_in.subcategory_id, user_id)
                if not sub or sub.category_id != cat_id_for_sub:
                    raise HTTPException(status_code=400, detail="Subcategoria inválida")
            else:
                sub = await self.subcategoria_repo.get_by_nome_and_categoria(
                    obj_in.subcategory_name, cat_id_for_sub, user_id
                )
                if not sub:
                    sub = await self.subcategoria_repo.create(
                        categoria_id=cat_id_for_sub,
                        user_id=user_id,
                        obj_in=SubcategoriaCreate(subcategory_name=obj_in.subcategory_name)
                    )
            trans.subcategory_id = sub.id

        # Set category_id after all validations pass
        if resolved_category_id is not None:
            trans.category_id = resolved_category_id

        # 3) Atualiza demais campos
        data = obj_in.model_dump(exclude_unset=True, exclude={
            "category_id", "category_name", "subcategory_id", "subcategory_name"
        })
        field_map = {
            'amount': 'amount',
            'description': 'description',
            'installment_number': 'installment_number',
            'total_installments': 'total_installments',
            'is_installment': 'is_installment',
            'transaction_date': 'transaction_date',
            'type': 'type',
            'entity_type': 'entity_type',
            'payment_method': 'payment_method',
        }
        for field, val in data.items():
            orm_field = field_map.get(field, field)
            setattr(trans, orm_field, val)

        try:
            await self.db.commit()
            await self.db.refresh(trans)
            return trans
        except IntegrityError:
            await self.db.rollback()
            raise HTTPException(status_code=400, detail="Erro ao atualizar transação")

    async def delete(self, id: int, user_id: Optional[int] = None) -> Optional[TransactionORM]:
        trans = await self.get_by_id(id, user_id)
        if not trans:
            return None
        await self.db.delete(trans)
        await self.db.commit()
        return trans

    async def check_duplicates(self, transaction_date: date, amount: float, user_id: Optional[int] = None) -> List[TransactionORM]:
        """Retorna transações existentes com a mesma data (ignorando hora) e valor."""
        from datetime import timedelta

        start = datetime.combine(transaction_date, time.min)
        end = datetime.combine(transaction_date, time.max)
        stmt = (
            select(TransactionORM)
            .where(
                TransactionORM.transaction_date >= start,
                TransactionORM.transaction_date <= end,
                TransactionORM.amount == amount,
            )
        )
        if user_id is not None:
            stmt = stmt.where(TransactionORM.user_id == user_id)
        result = await self.db.execute(stmt)
        return list(result.unique().scalars().all())

    async def assign_random_banks(self, bank_codes: List[str], user_id: Optional[int] = None) -> int:
        """Atribui um bank_code aleatório às transações sem bank_code usando SQL direto."""
        from sqlalchemy import text
        
        if not bank_codes:
            return 0

        # Single SQL statement using CTE + row_number() for random assignment
        user_filter = "AND user_id = :user_id" if user_id is not None else ""
        stmt = text(f"""
            WITH banks AS (
                SELECT bank_code, row_number() OVER (ORDER BY random()) AS rn
                FROM UNNEST(:bank_codes::text[]) AS bank_code
            ), txs AS (
                SELECT id, row_number() OVER (ORDER BY id) AS rn
                FROM transacoes
                WHERE bank_code IS NULL {user_filter}
            )
            UPDATE transacoes t
            SET bank_code = b.bank_code
            FROM txs
            JOIN banks b ON txs.rn = b.rn
            WHERE t.id = txs.id
        """)

        params = {'bank_codes': bank_codes}
        if user_id is not None:
            params['user_id'] = user_id
        result = await self.db.execute(stmt, params)
        await self.db.commit()
        return result.rowcount

    async def create_batch_from_extract(
        self,
        transactions: List[Dict],
        user_id: int,
    ) -> tuple[int, List[str]]:
        """
        Creates multiple transactions from extract in a single batch.
        Returns (created_count, errors_list).
        """
        log = log_database_operation(operation="batch_create", collection="transacoes", count=len(transactions), user_id=user_id)
        
        # 1) Collect all unique category/subcategory resolutions needed
        cat_keys = set()
        sub_keys = set()
        for t in transactions:
            if t.get('category_id'):
                cat_keys.add(('id', t['category_id']))
            elif t.get('category_name'):
                cat_keys.add(('name', t['category_name'], t['entity_type']))
            if t.get('subcategory_id'):
                sub_keys.add(('id', t['subcategory_id']))
            elif t.get('subcategory_name') and (t.get('category_id') or t.get('category_name')):
                cat_key = t.get('category_id') or t.get('category_name')
                sub_keys.add(('name', t['subcategory_name'], cat_key))

        # 2) Resolve all categories
        cat_cache: Dict[tuple, any] = {}
        for key in cat_keys:
            if key[0] == 'id':
                cat = await self.categoria_repo.get_by_id(key[1], user_id)
            else:  # name
                cat = await self.categoria_repo.get_by_nome_and_entity_type(key[1], key[2], user_id)
                if not cat:
                    cat = await self.categoria_repo.create(
                        user_id,
                        CategoriaCreate(
                            category_name=key[1],
                            entity_type=key[2],
                            limit=0,
                            type=None,  # will be overridden per transaction
                            subcategories=[],
                        )
                    )
            cat_cache[key] = cat

        # 3) Resolve all subcategories
        sub_cache: Dict[tuple, any] = {}
        for key in sub_keys:
            if key[0] == 'id':
                sub = await self.subcategoria_repo.get_by_id(key[1], user_id)
            else:  # name
                cat = cat_cache.get(('id', key[2])) or cat_cache.get(('name', key[2], None))
                if cat:
                    sub = await self.subcategoria_repo.get_by_nome_and_categoria(key[1], cat.id, user_id)
                    if not sub:
                        sub = await self.subcategoria_repo.create(
                            categoria_id=cat.id,
                            user_id=user_id,
                            obj_in=SubcategoriaCreate(subcategory_name=key[1]),
                        )
            sub_cache[key] = sub

        # 4) Build all TransactionORM objects
        all_instances = []
        errors = []

        for t in transactions:
            try:
                group_id = str(uuid4())
                cat_key = ('id', t['category_id']) if t.get('category_id') else ('name', t['category_name'], t['entity_type'])
                cat = cat_cache[cat_key]
                
                sub_key = None
                if t.get('subcategory_id'):
                    sub_key = ('id', t['subcategory_id'])
                elif t.get('subcategory_name'):
                    sub_key = ('name', t['subcategory_name'], cat_key)
                sub = sub_cache.get(sub_key) if sub_key else None

                transaction_date = datetime.strptime(t['date'], '%d/%m/%Y')
                total_installments = t.get('total_installments')
                is_installment = t.get('is_installment', False)

                if total_installments and total_installments > 1:
                    # Create installments
                    valor_parcela = self._calculate_installment_amount(t['amount'], total_installments)
                    datas = self._generate_installment_dates(transaction_date, total_installments)
                    for i in range(total_installments):
                        inst = TransactionORM(
                            amount=valor_parcela,
                            description=f"{t['description']} - parcela {i + 1}/{total_installments}",
                            installment_number=i + 1,
                            total_installments=total_installments,
                            is_installment=True,
                            transaction_date=datas[i],
                            type=t['type'],
                            entity_type=t['entity_type'],
                            payment_method=t['payment_method'],
                            category_id=cat.id,
                            subcategory_id=sub.id if sub else None,
                            bank_code=t.get('bank_code'),
                            group_id=group_id,
                            user_id=user_id,
                        )
                        all_instances.append(inst)
                    self._adjust_last_installment(all_instances[-total_installments:], t['amount'])
                else:
                    inst = TransactionORM(
                        amount=t['amount'],
                        description=t['description'],
                        installment_number=1,
                        total_installments=1,
                        transaction_date=transaction_date,
                        type=t['type'],
                        entity_type=t['entity_type'],
                        payment_method=t['payment_method'],
                        category_id=cat.id,
                        subcategory_id=sub.id if sub else None,
                        bank_code=t.get('bank_code'),
                        group_id=group_id,
                        is_installment=is_installment,
                        user_id=user_id,
                    )
                    all_instances.append(inst)
            except Exception as e:
                errors.append(f"Erro ao preparar '{t.get('description', 'N/A')}': {str(e)}")

        # 5) Batch insert all
        if all_instances:
            try:
                self.db.add_all(all_instances)
                await self.db.commit()
                for inst in all_instances:
                    await self.db.refresh(inst)
                log.info(f"Batch created {len(all_instances)} transactions")
            except Exception as e:
                await self.db.rollback()
                log.error(f"Batch commit failed: {e}")
                errors.append(f"Erro no commit em lote: {str(e)}")
                return 0, errors

        return len(all_instances), errors

    async def create_from_extract(
        self,
        amount: float,
        description: str,
        transaction_date: datetime,
        type: str,
        entity_type: str,
        payment_method: str,
        user_id: int,
        category_id: Optional[int] = None,
        subcategory_id: Optional[int] = None,
        category_name: Optional[str] = None,
        subcategory_name: Optional[str] = None,
        bank_code: Optional[str] = None,
        total_installments: Optional[int] = None,
        is_installment: bool = False,
    ) -> TransactionORM:
        group_id = str(uuid4())

        # 1) Resolve categoria: by ID or by name (cria se não existir)
        if category_id is not None:
            cat = await self.categoria_repo.get_by_id(category_id, user_id)
            if not cat:
                raise HTTPException(status_code=400, detail="Categoria não encontrada")
        elif category_name is not None:
            cat = await self.categoria_repo.get_by_nome(category_name, user_id)
            if not cat:
                cat = await self.categoria_repo.create(
                    user_id,
                    CategoriaCreate(
                        category_name=category_name,
                        entity_type=entity_type,
                        limit=0,
                        type=type,
                        subcategories=[],
                    )
                )
        else:
            raise HTTPException(status_code=400, detail="category_id or category_name is required")

        # 2) Resolve subcategoria: by ID or by nome (cria se não existir)
        sub = None
        if subcategory_id is not None:
            sub = await self.subcategoria_repo.get_by_id(subcategory_id, user_id)
            if not sub or sub.category_id != cat.id:
                raise HTTPException(status_code=400, detail="Subcategoria inválida")
        elif subcategory_name is not None:
            sub = await self.subcategoria_repo.get_by_nome_and_categoria(
                subcategory_name, cat.id, user_id
            )
            if not sub:
                sub = await self.subcategoria_repo.create(
                    categoria_id=cat.id,
                    user_id=user_id,
                    obj_in=SubcategoriaCreate(subcategory_name=subcategory_name),
                )

        # 3) Cria transação(ões) — com parcelamento se solicitado
        if total_installments is not None and total_installments > 1:
            valor_parcela = self._calculate_installment_amount(amount, total_installments)
            datas = self._generate_installment_dates(transaction_date, total_installments)
            transacoes = []
            for i in range(total_installments):
                inst = TransactionORM(
                    amount=valor_parcela,
                    description=f'{description} - parcela {i + 1}/{total_installments}',
                    installment_number=i + 1,
                    total_installments=total_installments,
                    is_installment=True,
                    transaction_date=datas[i],
                    type=type,
                    entity_type=entity_type,
                    payment_method=payment_method,
                    category_id=cat.id,
                    subcategory_id=sub.id if sub else None,
                    bank_code=bank_code,
                    group_id=group_id,
                    user_id=user_id,
                )
                self.db.add(inst)
                transacoes.append(inst)
            self._adjust_last_installment(transacoes, amount)
            await self.db.commit()
            for inst in transacoes:
                await self.db.refresh(inst)
            return transacoes[0]
        else:
            inst = TransactionORM(
                amount=amount,
                description=description,
                installment_number=1,
                total_installments=1,
                transaction_date=transaction_date,
                type=type,
                entity_type=entity_type,
                payment_method=payment_method,
                category_id=cat.id,
                subcategory_id=sub.id if sub else None,
                bank_code=bank_code,
                group_id=group_id,
                is_installment=is_installment,
                user_id=user_id,
            )
            self.db.add(inst)
            await self.db.commit()
            await self.db.refresh(inst)
            return inst
