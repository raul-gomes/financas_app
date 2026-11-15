"""
Seed script: fills the database with fictitious demo data (a couple with personal and
business finances) for the last DEMO_HISTORY_MONTHS months up to the current month.

DESTRUCTIVE: drops and recreates every table. Development/demo databases only.

Inside the container: docker exec financas-api python -m app.scripts.seed
Outside: DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5436/db python -m app.scripts.seed

The data is deterministic for a given date (fixed random seed), so screenshots can be
reproduced. Recurring-bill transactions share their recurring account's group_id, so the
app's monthly generation recognizes them and never duplicates a month.
"""

import asyncio
import calendar
import os
import random
import sys
from datetime import date, datetime
from pathlib import Path
from uuid import uuid4

# Make the project importable when run as a script
repo_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(repo_root))

from dotenv import load_dotenv

load_dotenv(repo_root.parent / ".env", override=False)

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.orm import Session

from app.db.base import Base
from app.db.models import (
    CategoryORM,
    RecurringAccountORM,
    ShoppingItemORM,
    SubcategoryORM,
    TransactionORM,
    UserBankORM,
    UserORM,
)

DEFAULT_SEED_EMAIL = "dev@example.com"
DEFAULT_SEED_NAME = "Usuário Dev"
DEMO_RANDOM_SEED = 20261115
DEMO_HISTORY_MONTHS = 18
LAST_SAFE_DAY = 28  # every month has it
MONTHLY_INFLATION = 0.004
AMOUNT_JITTER = 0.05
RECURRING_INSTALLMENTS = 12
# Recurring accounts started between these many months ago (varied installment numbers)
RECURRING_START_MONTHS_AGO = (2, 11)
SHOPPING_MONTHS_BACK = 2

# Payment methods as the app stores them (app.schemas.transaction.TipoPagamento)
CREDIT, DEBIT, PIX, TRANSFER, CASH, BOLETO = "credit", "debit", "pix", "transfer", "cash", "boleto"
PF, PJ = "individual", "business"

BANKS = [
    ("001", "Banco do Brasil"),
    ("341", "Itaú Unibanco"),
    ("260", "Nu Pagamentos (Nubank)"),
    ("208", "BTG Pactual"),
    ("077", "Banco Inter"),
]

PF_CATEGORIES = {
    "Salário": ("income", 0, ["Salário Fixo", "13º Salário", "Férias"]),
    "Freelance": ("income", 0, ["Projeto Avulso", "Consultoria"]),
    "Investimentos": ("income", 0, ["Dividendos", "Rendimentos", "Juros"]),
    "Aportes PF": ("investment", 0, ["Tesouro Direto", "CDB", "Ações"]),
    "Moradia": (
        "expense",
        4000,
        ["Aluguel", "Condomínio", "IPTU", "Conta de Luz", "Conta de Água", "Conta de Gás"],
    ),
    "Alimentação": (
        "expense",
        2500,
        ["Supermercado", "Feira", "Restaurante", "iFood", "Padaria"],
    ),
    "Transporte": (
        "expense",
        1800,
        ["Combustível", "Uber/99", "Estacionamento", "IPVA", "Seguro Auto"],
    ),
    "Saúde": ("expense", 1000, ["Plano de Saúde", "Farmácia", "Consulta Médica", "Exames"]),
    "Educação": ("expense", 400, ["Curso", "Livros", "Material"]),
    "Lazer": ("expense", 600, ["Cinema", "Streaming", "Show/Evento", "Viagem"]),
    "Vestuário": ("expense", 600, ["Roupas", "Calçados", "Acessórios"]),
    "Cuidados Pessoais": ("expense", 400, ["Academia", "Barbeiro", "Produtos"]),
    "Presentes": ("expense", 300, ["Aniversário", "Natal", "Dia dos Namorados"]),
    "Impostos PF": ("expense", 0, ["IRPF", "ITBI"]),
    "Metas": (
        "expense",
        0,
        ["Reserva de Emergência", "Viagem Europa", "Carro Novo", "Curso no Exterior"],
    ),
    "Financiamentos": (
        "expense",
        3500,
        ["Financiamento Imóvel", "Empréstimo Pessoal", "Crediário"],
    ),
}

PJ_CATEGORIES = {
    "Receita PJ": ("income", 0, ["NF-e Serviços", "NF-e Produtos", "Projeto Fixo"]),
    "Despesas Operacionais": (
        "expense",
        3000,
        ["Aluguel Escritório", "Energia", "Internet", "Telefone", "Material"],
    ),
    "Marketing": ("expense", 2000, ["Google Ads", "Facebook Ads", "Instagram", "Eventos"]),
    "Ferramentas": ("expense", 900, ["Software", "Hospedagem", "Domínio", "APIs"]),
    "Profissionais": ("expense", 4500, ["Contador", "Advogado", "Freelancer"]),
    "Impostos PJ": ("expense", 0, ["Simples Nacional", "DAS", "ISS", "PIS/COFINS"]),
    "Investimentos PJ": ("investment", 0, ["Tesouro Direto", "CDB", "Ações"]),
}

# Read by the dashboard: "Mensal" = monthly goal; "Limite Cartao Credito" = card limit
SPECIAL_CATEGORIES = [
    ("Mensal PF", PF, 15000),
    ("Mensal PJ", PJ, 10000),
    ("Limite Cartao Credito", PF, 15000),
    ("Limite Cartao Credito", PJ, 30000),
]

GOALS = [
    ("Reserva de Emergência", 30000),
    ("Viagem Europa", 15000),
    ("Carro Novo", 80000),
    ("Curso no Exterior", 25000),
]

# (description, amount, due day, category, subcategory, payment method, bank)
RECURRING_PF = [
    ("Aluguel", 2200, 5, "Moradia", "Aluguel", PIX, "260"),
    ("Condomínio", 650, 10, "Moradia", "Condomínio", BOLETO, "260"),
    ("Conta de Luz", 280, 15, "Moradia", "Conta de Luz", DEBIT, "260"),
    ("Conta de Água", 120, 18, "Moradia", "Conta de Água", DEBIT, "260"),
    ("Conta de Gás", 95, 20, "Moradia", "Conta de Gás", DEBIT, "260"),
    ("IPTU", 320, 3, "Moradia", "IPTU", BOLETO, "001"),
    ("Plano de Saúde", 450, 10, "Saúde", "Plano de Saúde", BOLETO, "341"),
    ("Academia", 150, 5, "Cuidados Pessoais", "Academia", PIX, "260"),
    ("Streaming Netflix", 55, 15, "Lazer", "Streaming", CREDIT, "260"),
    ("Streaming Spotify", 22, 20, "Lazer", "Streaming", CREDIT, "260"),
    ("Seguro Auto", 380, 10, "Transporte", "Seguro Auto", BOLETO, "341"),
    ("Financiamento Imóvel", 1850, 5, "Financiamentos", "Financiamento Imóvel", DEBIT, "001"),
    ("Curso Online", 97, 1, "Educação", "Curso", CREDIT, "260"),
]
RECURRING_PJ = [
    ("Aluguel Escritório", 1500, 5, "Despesas Operacionais", "Aluguel Escritório", TRANSFER, "077"),
    ("Internet", 120, 12, "Despesas Operacionais", "Internet", DEBIT, "077"),
    ("Celular", 85, 8, "Despesas Operacionais", "Telefone", DEBIT, "077"),
    ("Contador", 500, 10, "Profissionais", "Contador", PIX, "077"),
    ("Hospedagem AWS", 280, 1, "Ferramentas", "Hospedagem", CREDIT, "077"),
    ("Domínio + SSL", 45, 15, "Ferramentas", "Domínio", CREDIT, "077"),
    ("Google Workspace", 42, 20, "Ferramentas", "Software", CREDIT, "077"),
    ("Figma", 65, 12, "Ferramentas", "Software", CREDIT, "077"),
    ("DAS Simples Nacional", 850, 20, "Impostos PJ", "DAS", BOLETO, "077"),
    ("Google Ads", 600, 10, "Marketing", "Google Ads", CREDIT, "077"),
    ("Facebook Ads", 400, 15, "Marketing", "Facebook Ads", CREDIT, "077"),
]

# (description, amount, day, type, nature, method, category, subcategory, bank, months filter)
MONTHLY_ENTRIES = [
    ("Salário (titular)", 9800, 5, "income", PF, TRANSFER, "Salário", "Salário Fixo", "001", None),
    ("Salário (cônjuge)", 7200, 5, "income", PF, TRANSFER, "Salário", "Salário Fixo", "341", None),
    ("Projeto Freelance", 2500, 15, "income", PF, PIX, "Freelance", "Projeto Avulso", "260", 2),
    ("Dividendos", 350, 25, "income", PF, TRANSFER, "Investimentos", "Dividendos", "208", None),
    (
        "Rendimentos CDB",
        180,
        27,
        "income",
        PF,
        TRANSFER,
        "Investimentos",
        "Rendimentos",
        "208",
        None,
    ),
    (
        "Consultoria Tech",
        9000,
        10,
        "income",
        PJ,
        TRANSFER,
        "Receita PJ",
        "NF-e Serviços",
        "077",
        None,
    ),
    (
        "Projeto Fixo Cliente",
        12000,
        20,
        "income",
        PJ,
        TRANSFER,
        "Receita PJ",
        "Projeto Fixo",
        "077",
        3,
    ),
    (
        "Aporte Tesouro Direto",
        1500,
        6,
        "investment",
        PF,
        TRANSFER,
        "Aportes PF",
        "Tesouro Direto",
        "208",
        None,
    ),
    ("Aporte em Ações", 800, 22, "investment", PF, TRANSFER, "Aportes PF", "Ações", "208", 2),
    (
        "Aporte CDB empresa",
        2000,
        12,
        "investment",
        PJ,
        TRANSFER,
        "Investimentos PJ",
        "CDB",
        "077",
        None,
    ),
    (
        "Reserva de Emergência",
        500,
        7,
        "expense",
        PF,
        PIX,
        "Metas",
        "Reserva de Emergência",
        "208",
        None,
    ),
    ("Viagem Europa", 300, 7, "expense", PF, PIX, "Metas", "Viagem Europa", "208", None),
]

# (description, (min, max), category, subcategory, banks, methods, (min, max) times a month)
VARIABLE_PF = [
    (
        "Supermercado",
        (180, 350),
        "Alimentação",
        "Supermercado",
        ["260", "341"],
        [DEBIT, CREDIT],
        (3, 4),
    ),
    ("Feira livre", (60, 120), "Alimentação", "Feira", ["260"], [PIX, CASH], (2, 3)),
    ("Restaurante", (35, 75), "Alimentação", "Restaurante", ["260", "341"], [CREDIT, PIX], (3, 6)),
    ("iFood", (25, 65), "Alimentação", "iFood", ["260"], [CREDIT], (2, 4)),
    (
        "Combustível",
        (220, 350),
        "Transporte",
        "Combustível",
        ["341", "260"],
        [CREDIT, DEBIT],
        (2, 3),
    ),
    ("Uber", (15, 45), "Transporte", "Uber/99", ["260"], [CREDIT], (2, 5)),
    ("Farmácia", (40, 120), "Saúde", "Farmácia", ["260", "341"], [CREDIT, PIX], (1, 2)),
    ("Consulta Médica", (150, 300), "Saúde", "Consulta Médica", ["260"], [PIX], (0, 1)),
    ("Cinema", (40, 80), "Lazer", "Cinema", ["260"], [CREDIT], (1, 2)),
    ("Show/Evento", (100, 250), "Lazer", "Show/Evento", ["341"], [CREDIT], (0, 1)),
    ("Roupas", (100, 250), "Vestuário", "Roupas", ["341", "260"], [CREDIT], (0, 1)),
    ("Calçados", (150, 300), "Vestuário", "Calçados", ["341"], [CREDIT], (0, 1)),
    ("Barbeiro", (45, 65), "Cuidados Pessoais", "Barbeiro", ["260"], [PIX], (1, 2)),
    ("Livros", (30, 80), "Educação", "Livros", ["260"], [CREDIT], (0, 1)),
    ("Presente", (50, 200), "Presentes", "Aniversário", ["341"], [CREDIT], (0, 1)),
]
VARIABLE_PJ = [
    (
        "Material de escritório",
        (50, 200),
        "Despesas Operacionais",
        "Material",
        ["077"],
        [PIX, DEBIT],
        (1, 2),
    ),
    ("Licença de software", (30, 150), "Ferramentas", "Software", ["077"], [CREDIT], (0, 1)),
    ("Almoço de reunião", (80, 250), "Profissionais", "Freelancer", ["077"], [PIX], (1, 2)),
    ("Freelancer Design", (300, 800), "Profissionais", "Freelancer", ["077"], [PIX], (1, 1)),
    ("Freelancer Dev", (800, 1500), "Profissionais", "Freelancer", ["077"], [TRANSFER], (1, 1)),
    ("Patrocínio Instagram", (150, 400), "Marketing", "Instagram", ["077"], [CREDIT], (0, 1)),
    ("Evento de networking", (100, 300), "Marketing", "Eventos", ["077"], [PIX], (0, 1)),
]

# (description, total, installments, category, subcategory, method, bank, nature, months ago)
INSTALLMENT_PURCHASES = [
    ("Notebook", 5800, 12, "Financiamentos", "Crediário", CREDIT, "341", PF, 8),
    ("Celular", 4200, 10, "Financiamentos", "Crediário", CREDIT, "341", PF, 3),
    ("Sofá 3 lugares", 3200, 6, "Financiamentos", "Crediário", CREDIT, "260", PF, 14),
    ("Ar condicionado", 2800, 8, "Financiamentos", "Crediário", CREDIT, "341", PF, 1),
    ("Mesa de escritório", 1500, 5, "Despesas Operacionais", "Material", CREDIT, "077", PJ, 2),
    ("Cadeira ergonômica", 2200, 6, "Despesas Operacionais", "Material", CREDIT, "077", PJ, 10),
]

SHOPPING_ITEMS = [
    ("Fone de ouvido Bluetooth", PF),
    ("Tênis de corrida", PF),
    ("Mochila para notebook", PF),
    ("Luminária LED", PF),
    ("Roteador Wi-Fi 6", PF),
    ("Mouse sem fio", PJ),
    ("Teclado mecânico", PJ),
    ('Monitor 27"', PJ),
    ("Webcam HD", PJ),
    ("Suporte de monitor", PJ),
]


def add_months(year: int, month: int, delta: int) -> tuple[int, int]:
    """Shift a (year, month) pair by `delta` months."""
    index = year * 12 + (month - 1) + delta
    return index // 12, index % 12 + 1


def demo_months(today: date, count: int = DEMO_HISTORY_MONTHS) -> list[tuple[int, int]]:
    """The `count` months ending at (and including) the month of `today`, oldest first."""
    return [add_months(today.year, today.month, -offset) for offset in range(count - 1, -1, -1)]


def _days_allowed(year: int, month: int, today: date) -> int:
    """Last day that may hold a one-off entry: up to today in the current month."""
    if (year, month) == (today.year, today.month):
        return min(today.day, LAST_SAFE_DAY)
    return LAST_SAFE_DAY


def build_demo_data(
    db: Session,
    today: date,
    email: str = DEFAULT_SEED_EMAIL,
    name: str = DEFAULT_SEED_NAME,
) -> dict[str, int]:
    """Create one admin user and its fictitious finances; flushes, does not commit.

    One-off entries of the current month only go up to `today`; recurring bills and
    installments exist in full, future months included (as the app creates them).

    Returns:
        Counts per created entity (for the CLI summary).
    """
    rng = random.Random(DEMO_RANDOM_SEED)
    months = demo_months(today)

    user = UserORM(name=name, email=email, role="admin")
    db.add(user)
    db.flush()

    for code, bank_name in BANKS:
        db.add(UserBankORM(user_id=user.id, bank_code=code, bank_name=bank_name))

    categories: dict[str, int] = {}
    subcategories: dict[tuple[str, str], SubcategoryORM] = {}
    for nature, catalog in ((PF, PF_CATEGORIES), (PJ, PJ_CATEGORIES)):
        for cat_name, (cat_type, limit, subs) in catalog.items():
            category = CategoryORM(
                name=cat_name, entity_type=nature, limit=limit, type=cat_type, user_id=user.id
            )
            db.add(category)
            db.flush()
            categories[cat_name] = category.id
            for sub_name in subs:
                sub = SubcategoryORM(name=sub_name, category_id=category.id)
                db.add(sub)
                subcategories[(cat_name, sub_name)] = sub
    for cat_name, nature, limit in SPECIAL_CATEGORIES:
        db.add(
            CategoryORM(name=cat_name, entity_type=nature, limit=limit, type=None, user_id=user.id)
        )
    db.flush()
    for goal_name, target in GOALS:
        subcategories[("Metas", goal_name)].target_amount = target

    transactions: list[TransactionORM] = []

    def add_txn(
        description: str,
        amount: float,
        when: datetime,
        kind: str,
        nature: str,
        method: str,
        category: str,
        subcategory: str,
        bank: str | None,
        *,
        group_id: str | None = None,
        installment: int | None = None,
        total_installments: int | None = None,
        recurring_id: int | None = None,
    ) -> None:
        """Queue one transaction of the demo user."""
        txn = TransactionORM(
            group_id=group_id or str(uuid4()),
            amount=round(amount, 2),
            description=description,
            installment_number=installment,
            total_installments=total_installments,
            is_installment=installment is not None and recurring_id is None,
            transaction_date=when,
            type=kind,
            entity_type=nature,
            payment_method=method,
            bank_code=bank,
            category_id=categories[category],
            subcategory_id=subcategories[(category, subcategory)].id,
            recurring_account_id=recurring_id,
            user_id=user.id,
        )
        db.add(txn)
        transactions.append(txn)

    def jitter(base: float, month_index: int) -> float:
        """Base amount with mild inflation over time and a small random variation."""
        inflated = base * (1 + MONTHLY_INFLATION * month_index)
        return inflated + rng.uniform(-base * AMOUNT_JITTER, base * AMOUNT_JITTER)

    # Recurring bills: the account's 12 installments, sharing its group_id
    recurring_accounts: list[RecurringAccountORM] = []
    for nature, bills in ((PF, RECURRING_PF), (PJ, RECURRING_PJ)):
        for desc, amount, due_day, cat, sub, method, bank in bills:
            start_year, start_month = add_months(
                today.year, today.month, -rng.randint(*RECURRING_START_MONTHS_AGO)
            )
            account = RecurringAccountORM(
                user_id=user.id,
                description=desc,
                amount=amount,
                due_day=due_day,
                category_id=categories[cat],
                subcategory_id=subcategories[(cat, sub)].id,
                entity_type=nature,
                payment_method=method,
                bank_code=bank,
                start_date=datetime(start_year, start_month, 1),
                active=True,
                total_installments=RECURRING_INSTALLMENTS,
                group_id=str(uuid4()),
            )
            db.add(account)
            db.flush()
            recurring_accounts.append(account)
            # Like the app, every installment exists from the start (future ones included)
            for number in range(1, RECURRING_INSTALLMENTS + 1):
                year, month = add_months(start_year, start_month, number - 1)
                index = months.index((year, month)) if (year, month) in months else len(months)
                day = min(due_day, calendar.monthrange(year, month)[1])
                add_txn(
                    desc,
                    jitter(amount, index) if method != BOLETO else amount,
                    datetime(year, month, day),
                    "expense",
                    nature,
                    method,
                    cat,
                    sub,
                    bank,
                    group_id=account.group_id,
                    installment=number,
                    total_installments=RECURRING_INSTALLMENTS,
                    recurring_id=account.id,
                )

    # Incomes, investments and goal contributions (one-off entries of each month)
    for index, (year, month) in enumerate(months):
        last_day = _days_allowed(year, month, today)
        for desc, amount, day, kind, nature, method, cat, sub, bank, every in MONTHLY_ENTRIES:
            if every is not None and month % every != 0:
                continue
            if day > last_day:
                continue
            add_txn(
                desc,
                jitter(amount, index),
                datetime(year, month, day),
                kind,
                nature,
                method,
                cat,
                sub,
                bank,
            )

        # Variable expenses
        for nature, catalog in ((PF, VARIABLE_PF), (PJ, VARIABLE_PJ)):
            for desc, (low, high), cat, sub, banks, methods, (fmin, fmax) in catalog:
                for _ in range(rng.randint(fmin, fmax)):
                    day = rng.randint(1, LAST_SAFE_DAY)
                    if day > last_day:
                        continue
                    add_txn(
                        desc,
                        jitter(rng.uniform(low, high), index),
                        datetime(year, month, day),
                        "expense",
                        nature,
                        rng.choice(methods),
                        cat,
                        sub,
                        rng.choice(banks),
                    )

    # Installment purchases: every installment exists (past and future), one group each
    for desc, total, count, cat, sub, method, bank, nature, months_ago in INSTALLMENT_PURCHASES:
        group_id = str(uuid4())
        installment_value = total / count
        start_year, start_month = add_months(today.year, today.month, -months_ago)
        for number in range(1, count + 1):
            year, month = add_months(start_year, start_month, number - 1)
            add_txn(
                f"{desc} ({number}/{count})",
                installment_value,
                datetime(year, month, 10),
                "expense",
                nature,
                method,
                cat,
                sub,
                bank,
                group_id=group_id,
                installment=number,
                total_installments=count,
            )

    for item_name, nature in SHOPPING_ITEMS:
        year, month = add_months(today.year, today.month, -rng.randint(0, SHOPPING_MONTHS_BACK))
        db.add(
            ShoppingItemORM(
                user_id=user.id,
                name=item_name,
                reference_month=date(year, month, 1),
                entity_type=nature,
                checked=rng.choice([True, False]),
            )
        )

    db.flush()
    return {
        "users": 1,
        "banks": len(BANKS),
        "categories": len(PF_CATEGORIES) + len(PJ_CATEGORIES) + len(SPECIAL_CATEGORIES),
        "recurring_accounts": len(recurring_accounts),
        "transactions": len(transactions),
        "shopping_items": len(SHOPPING_ITEMS),
    }


def _reset_and_seed(sync_conn, today: date, email: str, name: str) -> dict[str, int]:
    """Drop and recreate every table, then build the demo data on this connection."""
    Base.metadata.drop_all(bind=sync_conn)
    Base.metadata.create_all(bind=sync_conn)
    with Session(bind=sync_conn) as db:
        counts = build_demo_data(db, today, email, name)
        db.commit()
    return counts


async def seed() -> None:
    """CLI entry point: reset the database pointed by DATABASE_URL and seed demo data."""
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL não definida.")
    engine = create_async_engine(database_url)
    try:
        async with engine.begin() as conn:
            counts = await conn.run_sync(
                _reset_and_seed,
                date.today(),
                os.getenv("SEED_USER_EMAIL", DEFAULT_SEED_EMAIL),
                os.getenv("SEED_USER_NAME", DEFAULT_SEED_NAME),
            )
    finally:
        await engine.dispose()
    print("Seed concluído com sucesso!")
    for key, value in counts.items():
        print(f"  - {key}: {value}")


if __name__ == "__main__":
    asyncio.run(seed())
