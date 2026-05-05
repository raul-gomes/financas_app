import asyncio
import random
from datetime import datetime, timedelta
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.db.models.categoria import CategoriaORM, SubcategoriaORM
from app.db.models.transacao import TransacaoORM
from app.schemas.transacao import TipoTransacao, NaturezaTransacao, TipoPagamento

async def seed():
    async with AsyncSessionLocal() as session:
        print("Semeando categorias...")
        
        # Categorias e Subcategorias base
        categories_data = [
            {
                "nome": "Moradia",
                "natureza": "pf",
                "limite": 2500.0,
                "subcategorias": ["Aluguel", "Energia", "Água", "Internet", "Condomínio"]
            },
            {
                "nome": "Alimentação",
                "natureza": "pf",
                "limite": 1500.0,
                "subcategorias": ["Supermercado", "Restaurante", "Delivery", "Padaria"]
            },
            {
                "nome": "Transporte",
                "natureza": "pf",
                "limite": 800.0,
                "subcategorias": ["Combustível", "Uber", "Estacionamento", "Manutenção"]
            },
            {
                "nome": "Lazer",
                "natureza": "pf",
                "limite": 500.0,
                "subcategorias": ["Cinema", "Viagem", "Hobby", "Show"]
            },
            {
                "nome": "Serviços PJ",
                "natureza": "pj",
                "limite": 10000.0,
                "subcategorias": ["Desenvolvimento", "Consultoria", "Treinamento"]
            },
            {
                "nome": "Infraestrutura PJ",
                "natureza": "pj",
                "limite": 3000.0,
                "subcategorias": ["AWS", "Google Cloud", "Software SaaS", "Equipamentos"]
            },
            {
                "nome": "Salário / Pró-labore",
                "natureza": "all",
                "limite": 0.0,
                "subcategorias": ["Principal", "Bonificação"]
            }
        ]

        created_categories = []
        from sqlalchemy import select
        for cat_item in categories_data:
            # Verificar se já existe
            res = await session.execute(select(CategoriaORM).where(CategoriaORM.categoria_nome == cat_item["nome"]))
            existing_cat = res.unique().scalar_one_or_none()
            
            if existing_cat:
                print(f"Categoria {cat_item['nome']} já existe. Pulando criação.")
                created_categories.append(existing_cat)
                continue

            cat = CategoriaORM(
                categoria_nome=cat_item["nome"],
                natureza=cat_item["natureza"],
                limite=cat_item["limite"]
            )
            session.add(cat)
            await session.flush() # Para pegar o ID
            
            for sub_nome in cat_item["subcategorias"]:
                sub = SubcategoriaORM(
                    subcategoria_nome=sub_nome,
                    categoria_id=cat.id
                )
                session.add(sub)
            
            created_categories.append(cat)
        
        await session.commit()
        print(f"{len(created_categories)} categorias criadas.")

        # Gerar transações
        print("Gerando transações...")
        
        # Helper para pegar subcategorias aleatórias de uma categoria
        async def get_subs(cat_id):
            from sqlalchemy import select
            res = await session.execute(select(SubcategoriaORM).where(SubcategoriaORM.categoria_id == cat_id))
            return res.unique().scalars().all()

        transactions = []
        today = datetime.now()

        # 1. Entradas (Salário)
        salario_cat = next(c for c in created_categories if c.categoria_nome == "Salário / Pró-labore")
        salario_subs = await get_subs(salario_cat.id)
        
        for i in range(3): # Últimos 3 meses
            data = today - timedelta(days=30*i)
            transactions.append(TransacaoORM(
                valor=8500.0,
                descricao=f"Salário Mensal - Mês {data.month}",
                data_transacao=data.replace(day=5),
                tipo="entrada",
                natureza="pf",
                forma_pagamento="transferencia",
                categoria_id=salario_cat.id,
                subcategoria_id=salario_subs[0].id
            ))

        # 2. Despesas Fixas (Moradia)
        moradia_cat = next(c for c in created_categories if c.categoria_nome == "Moradia")
        moradia_subs = await get_subs(moradia_cat.id)
        
        for i in range(3):
            data = today - timedelta(days=30*i)
            transactions.append(TransacaoORM(
                valor=1800.0,
                descricao=f"Aluguel Apartamento",
                data_transacao=data.replace(day=10),
                tipo="saida",
                natureza="pf",
                forma_pagamento="boleto", # Backend aceita qualquer string em forma_pagamento se não for validado strict
                categoria_id=moradia_cat.id,
                subcategoria_id=next(s for s in moradia_subs if s.subcategoria_nome == "Aluguel").id
            ))
            transactions.append(TransacaoORM(
                valor=250.0,
                descricao=f"Conta de Energia",
                data_transacao=data.replace(day=15),
                tipo="saida",
                natureza="pf",
                forma_pagamento="pix",
                categoria_id=moradia_cat.id,
                subcategoria_id=next(s for s in moradia_subs if s.subcategoria_nome == "Energia").id
            ))

        # 3. Despesas PJ (Infra)
        pj_cat = next(c for c in created_categories if c.categoria_nome == "Infraestrutura PJ")
        pj_subs = await get_subs(pj_cat.id)
        
        for i in range(3):
            data = today - timedelta(days=30*i)
            transactions.append(TransacaoORM(
                valor=450.0,
                descricao=f"Fatura AWS Cloud",
                data_transacao=data.replace(day=20),
                tipo="saida",
                natureza="pj",
                forma_pagamento="credito",
                categoria_id=pj_cat.id,
                subcategoria_id=next(s for s in pj_subs if s.subcategoria_nome == "AWS").id
            ))

        # 4. Transação Parcelada (Equipamentos PJ)
        infra_cat = next(c for c in created_categories if c.categoria_nome == "Infraestrutura PJ")
        infra_subs = await get_subs(infra_cat.id)
        equip_sub = next(s for s in infra_subs if s.subcategoria_nome == "Equipamentos")
        
        group_id = uuid4()
        total_valor = 3600.0
        parcelas = 3
        data_inicio = today - timedelta(days=45)
        
        for i in range(parcelas):
            transactions.append(TransacaoORM(
                group_id=group_id,
                valor=total_valor / parcelas,
                descricao=f"MacBook Air - Parcela {i+1}/{parcelas}",
                data_transacao=data_inicio + timedelta(days=30*i),
                tipo="saida",
                natureza="pj",
                forma_pagamento="credito",
                parcela=i+1,
                total_parcelas=parcelas,
                categoria_id=infra_cat.id,
                subcategoria_id=equip_sub.id
            ))

        # 5. Gastos Aleatórios (Alimentação e Lazer)
        alim_cat = next(c for c in created_categories if c.categoria_nome == "Alimentação")
        alim_subs = await get_subs(alim_cat.id)
        lazer_cat = next(c for c in created_categories if c.categoria_nome == "Lazer")
        lazer_subs = await get_subs(lazer_cat.id)

        for _ in range(15):
            days_ago = random.randint(0, 60)
            data = today - timedelta(days=days_ago)
            
            if random.random() > 0.4:
                cat = alim_cat
                sub = random.choice(alim_subs)
                valor = random.uniform(20.0, 350.0)
                desc = f"Gasto {sub.subcategoria_nome}"
            else:
                cat = lazer_cat
                sub = random.choice(lazer_subs)
                valor = random.uniform(50.0, 200.0)
                desc = f"Lazer {sub.subcategoria_nome}"

            transactions.append(TransacaoORM(
                valor=round(valor, 2),
                descricao=desc,
                data_transacao=data,
                tipo="saida",
                natureza="pf",
                forma_pagamento=random.choice(["pix", "debito", "credito", "dinheiro"]),
                categoria_id=cat.id,
                subcategoria_id=sub.id
            ))

        for t in transactions:
            session.add(t)
        
        await session.commit()
        print(f"{len(transactions)} transações criadas.")

if __name__ == "__main__":
    asyncio.run(seed())
