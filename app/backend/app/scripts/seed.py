"""
Seed script — popula o banco de dados com dados realistas de 2025-2026.
Dentro do container: docker exec financas-api python -m app.scripts.seed
Fora do container: DATABASE_URL=postgresql://postgres:postgres@localhost:5436/financas python -m app.scripts.seed
"""
import sys
import os
from pathlib import Path

# Garantir que o path do projeto esteja no sys.path
repo_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(repo_root))

from dotenv import load_dotenv
load_dotenv(repo_root.parent / ".env", override=False)

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.db.base import Base
from app.db.models import (
    CategoryORM, SubcategoryORM, UserORM, UserBankORM,
    RecurringAccountORM, TransactionORM, ShoppingItemORM,
)
from uuid import uuid4
from datetime import datetime, date
import random

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL não definida. Verifique o arquivo .env")

# Converter async URL para sync (remover +asyncpg)
sync_url = DATABASE_URL.replace("+asyncpg", "")
engine = create_engine(sync_url, echo=False, future=True)
SessionLocal = sessionmaker(bind=engine)


def seed():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # ── Usuário ──────────────────────────────────────────────
        user = UserORM(name="Raul Gomes", email="rsgomes86@gmail.com")
        db.add(user)
        db.flush()

        # ── Bancos do usuário ────────────────────────────────────
        banks_data = [
            ("001", "Banco do Brasil"),
            ("341", "Itaú Unibanco"),
            ("260", "Nu Pagamentos (Nubank)"),
            ("208", "BTG Pactual"),
            ("077", "Banco Inter"),
            ("212", "Banco Original"),
            ("707", "Daycoval"),
        ]
        banks = {}
        for code, name in banks_data:
            b = UserBankORM(user_id=user.id, bank_code=code, bank_name=name)
            db.add(b)
            db.flush()
            banks[code] = b

        # ── Categorias PF (individual) ──────────────────────────
        pf_categories = {
            "Salário": {"type": "income", "limit": 0, "subs": ["Salário Fixo", "13º Salário", "Férias"]},
            "Freelance": {"type": "income", "limit": 0, "subs": ["Projeto Avulso", "Consultoria"]},
            "Investimentos": {"type": "income", "limit": 0, "subs": ["Dividendos", "Rendimentos", "Juros"]},
            "Moradia": {"type": "expense", "limit": 3500, "subs": ["Aluguel", "Condomínio", "IPTU", "Conta de Luz", "Conta de Água", "Conta de Gás"]},
            "Alimentação": {"type": "expense", "limit": 2000, "subs": ["Supermercado", "Feira", "Restaurante", "iFood", "Padaria"]},
            "Transporte": {"type": "expense", "limit": 1200, "subs": ["Combustível", "Uber/99", "Estacionamento", "IPVA", "Seguro Auto"]},
            "Saúde": {"type": "expense", "limit": 800, "subs": ["Plano de Saúde", "Farmácia", "Consulta Médica", "Exames"]},
            "Educação": {"type": "expense", "limit": 600, "subs": ["Curso", "Livros", "Material"]},
            "Lazer": {"type": "expense", "limit": 1000, "subs": ["Cinema", "Streaming", "Show/Evento", "Viagem"]},
            "Vestuário": {"type": "expense", "limit": 500, "subs": ["Roupas", "Calçados", "Acessórios"]},
            "Cuidados Pessoais": {"type": "expense", "limit": 400, "subs": ["Barbeiro", "Produtos", "Spa"]},
            "Presentes": {"type": "expense", "limit": 300, "subs": ["Aniversário", "Natal", "Dia dos Namorados"]},
            "Impostos PF": {"type": "expense", "limit": 0, "subs": ["IRPF", "ITBI"]},
            "Metas": {"type": "expense", "limit": 0, "subs": ["Reserva de Emergência", "Viagem Europa", "Carro Novo", "Curso no Exterior"]},
            "Financiamentos": {"type": "expense", "limit": 2500, "subs": ["Financiamento Imóvel", "Empréstimo Pessoal", "Crediário"]},
        }

        # ── Categorias PJ (business) ────────────────────────────
        pj_categories = {
            "Receita PJ": {"type": "income", "limit": 0, "subs": ["NF-e Serviços", "NF-e Produtos", "Projeto Fixo"]},
            "Despesas Operacionais": {"type": "expense", "limit": 5000, "subs": ["Aluguel Escritório", "Energia", "Internet", "Telefone"]},
            "Marketing": {"type": "expense", "limit": 3000, "subs": ["Google Ads", "Facebook Ads", "Instagram", "Design Gráfico"]},
            "Ferramentas": {"type": "expense", "limit": 1500, "subs": ["Software", "Hospedagem", "Domínio", "APIs"]},
            "Profissionais": {"type": "expense", "limit": 4000, "subs": ["Contador", "Advogado", "Freelancer"]},
            "Impostos PJ": {"type": "expense", "limit": 0, "subs": ["Simples Nacional", "DAS", "ISS", "PIS/COFINS"]},
            "Investimentos PJ": {"type": "investment", "limit": 0, "subs": ["Tesouro Direto", "CDB", "Ações"]},
        }

        cat_map = {}
        for cat_name, cat_data in {**pf_categories, **pj_categories}.items():
            entity = "individual" if cat_name in pf_categories else "business"
            c = CategoryORM(name=cat_name, entity_type=entity, limit=cat_data["limit"], type=cat_data["type"])
            db.add(c)
            db.flush()
            cat_map[cat_name] = {"id": c.id, "subs": {}}
            for sub_name in cat_data["subs"]:
                s = SubcategoryORM(name=sub_name, category_id=c.id)
                db.add(s)
                db.flush()
                cat_map[cat_name]["subs"][sub_name] = s.id

        # ── Categorias especiais de limite (lidas pelo dashboard) ──
        # "Mensal PF"/"Mensal PJ" = meta mensal do gráfico; "Limite Cartao Credito" = limite do cartão por natureza
        special_categories = [
            ("Mensal PF", "individual", 6000),
            ("Mensal PJ", "business", 12000),
            ("Limite Cartao Credito", "individual", 15000),
            ("Limite Cartao Credito", "business", 30000),
        ]
        for cat_name, entity, limit_value in special_categories:
            c = CategoryORM(name=cat_name, entity_type=entity, limit=limit_value, type=None)
            db.add(c)
            db.flush()

        # ── Metas com target_amount ─────────────────────────────
        goals_data = [
            ("Reserva de Emergência", 30000),
            ("Viagem Europa", 15000),
            ("Carro Novo", 80000),
            ("Curso no Exterior", 25000),
        ]
        for goal_name, target in goals_data:
            sub_id = cat_map["Metas"]["subs"][goal_name]
            sub = db.query(SubcategoryORM).get(sub_id)
            sub.target_amount = target
        db.flush()

        # ── Contas Recorrentes PF ───────────────────────────────
        recurring_pf = [
            ("Aluguel", 2200, 5, "Moradia", "Aluguel", "pix", "260"),
            ("Condomínio", 650, 10, "Moradia", "Condomínio", "boleto", "260"),
            ("Conta de Luz", 280, 15, "Moradia", "Conta de Luz", "debito", "260"),
            ("Conta de Água", 120, 18, "Moradia", "Conta de Água", "debito", "260"),
            ("Conta de Gás", 95, 20, "Moradia", "Conta de Gás", "debito", "260"),
            ("Plano de Saúde", 450, 10, "Saúde", "Plano de Saúde", "boleto", "341"),
            ("Academia", 150, 5, "Cuidados Pessoais", "Produtos", "pix", "260"),
            ("Internet", 120, 12, "Despesas Operacionais", "Internet", "debito", "260"),
            ("Celular", 85, 8, "Despesas Operacionais", "Telefone", "debito", "260"),
            ("Streaming Netflix", 55, 15, "Lazer", "Streaming", "credito", "260"),
            ("Streaming Spotify", 22, 20, "Lazer", "Streaming", "credito", "260"),
            ("Seguro Auto", 380, 10, "Transporte", "Seguro Auto", "boleto", "341"),
            ("Financiamento Imóvel", 1850, 5, "Financiamentos", "Financiamento Imóvel", "debito", "001"),
            ("Curso Online", 97, 1, "Educação", "Curso", "credito", "260"),
            ("IPTU", 320, 3, "Moradia", "IPTU", "boleto", "001"),
        ]

        recurring_pj = [
            ("Aluguel Escritório", 1500, 5, "Despesas Operacionais", "Aluguel Escritório", "transferencia", "077"),
            ("Contador", 500, 10, "Profissionais", "Contador", "pix", "077"),
            ("Hospedagem AWS", 280, 1, "Ferramentas", "Hospedagem", "credito", "077"),
            ("Domínio + SSL", 45, 15, "Ferramentas", "Domínio", "credito", "077"),
            ("Google Workspace", 42, 20, "Ferramentas", "Software", "credito", "077"),
            ("Figma", 65, 12, "Ferramentas", "Software", "credito", "077"),
            ("DAS Simples Nacional", 850, 20, "Impostos PJ", "DAS", "boleto", "077"),
            ("Google Ads", 600, 10, "Marketing", "Google Ads", "credito", "077"),
            ("Facebook Ads", 400, 15, "Marketing", "Facebook Ads", "credito", "077"),
        ]

        recurring_accounts = []
        for desc, amt, day, cat, sub, method, bank in recurring_pf:
            r = RecurringAccountORM(
                description=desc, amount=amt, due_day=day,
                category_id=cat_map[cat]["id"], subcategory_id=cat_map[cat]["subs"][sub],
                entity_type="individual", payment_method=method, bank_code=bank,
                start_date=datetime(2025, 1, 1), active=True, total_installments=12,
            )
            db.add(r)
            db.flush()
            recurring_accounts.append(r)

        for desc, amt, day, cat, sub, method, bank in recurring_pj:
            r = RecurringAccountORM(
                description=desc, amount=amt, due_day=day,
                category_id=cat_map[cat]["id"], subcategory_id=cat_map[cat]["subs"][sub],
                entity_type="business", payment_method=method, bank_code=bank,
                start_date=datetime(2025, 1, 1), active=True, total_installments=12,
            )
            db.add(r)
            db.flush()
            recurring_accounts.append(r)

        # ── Transações ──────────────────────────────────────────
        transactions = []
        group_base = str(uuid4())

        def add_txn(desc, amt, dt, typ, etyp, method, cat, sub, bank=None, installment=None, total_inst=None, recurring_id=None):
            g = str(uuid4())
            t = TransactionORM(
                group_id=g, amount=amt, description=desc,
                installment_number=installment, total_installments=total_inst,
                is_installment=installment is not None,
                transaction_date=dt, type=typ, entity_type=etyp,
                payment_method=method, bank_code=bank,
                category_id=cat_map[cat]["id"], subcategory_id=cat_map[cat]["subs"][sub],
                recurring_account_id=recurring_id,
            )
            db.add(t)
            transactions.append(t)

        months_2025 = [(2025, m) for m in range(1, 13)]
        months_2026 = [(2026, m) for m in range(1, 9)]  # Jan-Ago 2026

        # Variação de valores por mês (inflação leve)
        def variation(base, month_factor=1.0):
            return round(base * month_factor + random.uniform(-base*0.05, base*0.05), 2)

        # ── Receitas PF (Salário + Freelance + Investimentos) ──
        for year, month in months_2025 + months_2026:
            factor = 1 + (month - 1) * 0.005  # inflação mensal leve

            # Salário Fixo
            add_txn("Salário Fixo", variation(8500, factor), datetime(year, month, 5),
                    "income", "individual", "transferencia", "Salário", "Salário Fixo", "001")

            # Freelance (alguns meses)
            if month in [2, 4, 6, 8, 10, 12]:
                add_txn("Projeto Freelance", variation(2500, factor), datetime(year, month, 15),
                        "income", "individual", "pix", "Freelance", "Projeto Avulso", "260")

            # Consultoria PJ (mensal)
            add_txn("Consultoria Tech", variation(4500, factor), datetime(year, month, 10),
                    "income", "business", "transferencia", "Receita PJ", "NF-e Serviços", "077")

            # Projeto Fixo PJ
            if month % 3 == 0:
                add_txn("Projeto Fixo Client", variation(12000, factor), datetime(year, month, 20),
                        "income", "business", "transferencia", "Receita PJ", "Projeto Fixo", "077")

            # Dividendos (mensal)
            add_txn("Dividendos", variation(350, factor), datetime(year, month, 25),
                    "income", "individual", "transferencia", "Investimentos", "Dividendos", "208")

            # Rendimentos CDB
            add_txn("Rendimentos CDB", variation(180, factor), datetime(year, month, 28),
                    "income", "individual", "transferencia", "Investimentos", "Rendimentos", "208")

        # ── Despesas recorrentes PF (geradas a partir das contas recorrentes) ──
        for year, month in months_2025 + months_2026:
            for r in recurring_accounts:
                if r.entity_type != "individual":
                    continue
                day = min(r.due_day, 28)
                dt = datetime(year, month, day)
                factor = 1 + (month - 1) * 0.003
                add_txn(r.description, variation(r.amount, factor), dt,
                        "expense", "individual", r.payment_method,
                        db.query(CategoryORM).get(r.category_id).name,
                        db.query(SubcategoryORM).get(r.subcategory_id).name,
                        r.bank_code, recurring_id=r.id)

        # ── Despesas recorrentes PJ ──
        for year, month in months_2025 + months_2026:
            for r in recurring_accounts:
                if r.entity_type != "business":
                    continue
                day = min(r.due_day, 28)
                dt = datetime(year, month, day)
                factor = 1 + (month - 1) * 0.003
                add_txn(r.description, variation(r.amount, factor), dt,
                        "expense", "business", r.payment_method,
                        db.query(CategoryORM).get(r.category_id).name,
                        db.query(SubcategoryORM).get(r.subcategory_id).name,
                        r.bank_code, recurring_id=r.id)

        # ── Despesas variáveis PF ───────────────────────────────
        variaveis_pf = [
            # Supermercado (semanal)
            ("Supermercado Extra", (180, 350), "Alimentação", "Supermercado", ["260", "341"], ["debito", "credito"]),
            ("Feira livre", (60, 120), "Alimentação", "Feira", ["260"], ["pix", "dinheiro"]),
            # Restaurantes
            ("Restaurante Almoço", (35, 75), "Alimentação", "Restaurante", ["260", "341"], ["credito", "pix"]),
            ("Jantar Fora", (80, 180), "Alimentação", "Restaurante", ["260", "341"], ["credito"]),
            ("iFood", (25, 65), "Alimentação", "iFood", ["260"], ["credito"]),
            # Transporte
            ("Combustível", (250, 400), "Transporte", "Combustível", ["341", "260"], ["credito", "debito"]),
            ("Uber", (15, 60), "Transporte", "Uber/99", ["260"], ["credito"]),
            # Saúde
            ("Farmácia", (40, 120), "Saúde", "Farmácia", ["260", "341"], ["credito", "pix"]),
            ("Consulta Médica", (150, 300), "Saúde", "Consulta Médica", ["260"], ["pix"]),
            # Lazer
            ("Cinema", (40, 80), "Lazer", "Cinema", ["260"], ["credito"]),
            ("Show/Evento", (100, 350), "Lazer", "Show/Evento", ["341"], ["credito"]),
            # Vestuário
            ("Roupas", (100, 300), "Vestuário", "Roupas", ["341", "260"], ["credito"]),
            ("Calçados", (150, 350), "Vestuário", "Calçados", ["341"], ["credito"]),
            # Cuidados
            ("Barbeiro", (45, 65), "Cuidados Pessoais", "Barbeiro", ["260"], ["pix"]),
            # Educação
            ("Livros", (30, 80), "Educação", "Livros", ["260"], ["credito"]),
            # Presentes
            ("Presente Aniversário", (50, 200), "Presentes", "Aniversário", ["341"], ["credito"]),
        ]

        for year, month in months_2025 + months_2026:
            factor = 1 + (month - 1) * 0.005
            for desc, (low, high), cat, sub, bank_opts, method_opts in variaveis_pf:
                # Frequência variável
                if desc in ["Supermercado Extra"]:
                    freq = random.randint(3, 5)
                elif desc in ["Feira livre", "Combustível"]:
                    freq = random.randint(2, 4)
                elif desc in ["Restaurante Almoço"]:
                    freq = random.randint(4, 8)
                elif desc in ["iFood", "Uber"]:
                    freq = random.randint(2, 6)
                else:
                    freq = 1

                for _ in range(freq):
                    day = random.randint(1, 28)
                    amt = variation(random.uniform(low, high), factor)
                    add_txn(desc, amt, datetime(year, month, day),
                            "expense", "individual",
                            random.choice(method_opts),
                            cat, sub, random.choice(bank_opts))

        # ── Despesas variáveis PJ ───────────────────────────────
        variaveis_pj = [
            ("Compra Material Escritório", (50, 200), "Despesas Operacionais", "Energia", ["077"], ["pix", "debito"]),
            ("Software Licença Extra", (30, 150), "Ferramentas", "Software", ["077"], ["credito"]),
            ("Almoço Reunião", (80, 250), "Profissionais", "Freelancer", ["077"], ["pix"]),
            ("Freelancer Design", (300, 800), "Profissionais", "Freelancer", ["077"], ["pix"]),
            ("Freelancer Dev", (500, 1500), "Profissionais", "Freelancer", ["077"], ["transferencia"]),
            ("Propaganda Sponsor", (200, 600), "Marketing", "Instagram", ["077"], ["credito"]),
            ("Evento Networking", (100, 300), "Marketing", "Design Gráfico", ["077"], ["pix"]),
        ]

        for year, month in months_2025 + months_2026:
            factor = 1 + (month - 1) * 0.005
            for desc, (low, high), cat, sub, bank_opts, method_opts in variaveis_pj:
                freq = random.randint(1, 3)
                for _ in range(freq):
                    day = random.randint(5, 25)
                    amt = variation(random.uniform(low, high), factor)
                    add_txn(desc, amt, datetime(year, month, day),
                            "expense", "business",
                            random.choice(method_opts),
                            cat, sub, random.choice(bank_opts))

        # ── Parcelamentos PF (compras parceladas) ────────────────
        parcelamentos = [
            ("Notebook Dell", 5800, 12, "Financiamentos", "Crediário", "credito", "341", "individual"),
            ("Celular iPhone", 6200, 10, "Financiamentos", "Crediário", "credito", "341", "individual"),
            ("Sofá 3 lugares", 3200, 6, "Financiamentos", "Crediário", "credito", "260", "individual"),
            ("Ar Condicionado", 2800, 8, "Financiamentos", "Crediário", "credito", "341", "individual"),
            ("Mesa Escritório", 1500, 5, "Financiamentos", "Crediário", "credito", "077", "business"),
            ("Cadeira Ergonômica", 2200, 6, "Financiamentos", "Crediário", "credito", "077", "business"),
        ]

        for desc, total, installments, cat, sub, method, bank, etyp in parcelamentos:
            parcela = round(total / installments, 2)
            start_month = random.randint(1, 6)
            start_year = 2025
            for i in range(1, installments + 1):
                m = start_month + i - 1
                y = start_year + (m - 1) // 12
                m = ((m - 1) % 12) + 1
                if y > 2026 or (y == 2026 and m > 8):
                    break
                add_txn(f"{desc} ({i}/{installments})", parcela, datetime(y, m, 10),
                        "expense", etyp, method, cat, sub, bank,
                        installment=i, total_inst=installments)

        # ── Shopping Items ──────────────────────────────────────
        shopping_items = [
            ("Fone de Ouvido Bluetooth", "individual"),
            ("Capa Celular", "individual"),
            ("Carregador Portátil", "individual"),
            ("Camiseta Polo", "individual"),
            ("Tênis Running", "individual"),
            ("Mochila Notebook", "individual"),
            ("Mouse Wireless", "business"),
            ("Teclado Mecânico", "business"),
            ("Monitor 27\"", "business"),
            ("Webcam HD", "business"),
            ("Hub USB-C", "business"),
            ("Cabo HDMI 2m", "individual"),
            ("Papel A4 (1000 folhas)", "business"),
            ("Caneta Esferográfica (12un)", "business"),
            ("Organizador de Mesa", "business"),
            ("Luminária LED", "individual"),
            ("Almofada Ergonômica", "individual"),
            ("Suporte de Monitor", "business"),
            (" SSD 1TB", "business"),
            ("Roteador Wi-Fi 6", "individual"),
        ]

        for name, etyp in shopping_items:
            si = ShoppingItemORM(
                name=name,
                reference_month=date(2026, random.randint(1, 8), 1),
                entity_type=etyp,
                checked=random.choice([True, False]),
            )
            db.add(si)

        db.commit()
        print(f"Seed concluído com sucesso!")
        print(f"  - 1 usuário")
        print(f"  - {len(banks)} bancos")
        print(f"  - {len(pf_categories) + len(pj_categories) + len(special_categories)} categorias (incl. {len(special_categories)} especiais de limite)")
        print(f"  - {len(recurring_accounts)} contas recorrentes")
        print(f"  - {len(transactions)} transações (2025-2026)")
        print(f"  - {len(shopping_items)} itens de compra")
    except Exception as e:
        db.rollback()
        print(f"Erro no seed: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
