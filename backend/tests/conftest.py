import asyncio
import pytest
import pytest_asyncio
from contextlib import asynccontextmanager
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.base import Base
from app.core.database import get_session

TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,
)

TestSessionLocal = async_sessionmaker(
    bind=engine, class_=AsyncSession, expire_on_commit=False
)


@pytest_asyncio.fixture(autouse=True)
async def setup_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture
async def client():
    async with TestSessionLocal() as session:
        async def override_get_session():
            yield session

        app.dependency_overrides[get_session] = override_get_session

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c

        app.dependency_overrides.clear()


def categoria_payload(nome="Alimentacao", natureza="pf", limite=1000.0, subs=None):
    return {
        "categoria_nome": nome,
        "natureza": natureza,
        "limite": limite,
        "subcategorias": subs or [{"subcategoria_nome": "Supermercado"}],
    }


def transacao_payload(
    valor=50.0,
    descricao="Compras",
    data_transacao="2026-01-15T10:00:00",
    tipo="saida",
    natureza="pf",
    forma_pagamento="pix",
    categoria_id=None,
    categoria_nome="Alimentacao",
    subcategoria_id=None,
    subcategoria_nome="Supermercado",
):
    return {
        "valor": valor,
        "descricao": descricao,
        "data_transacao": data_transacao,
        "tipo": tipo,
        "natureza": natureza,
        "forma_pagamento": forma_pagamento,
        "categoria_id": categoria_id,
        "categoria_nome": categoria_nome,
        "subcategoria_id": subcategoria_id,
        "subcategoria_nome": subcategoria_nome,
    }


def conta_recorrente_payload(
    descricao="Aluguel",
    valor=1500.0,
    dia_vencimento=10,
    categoria_id=1,
    subcategoria_id=1,
    natureza="pf",
    forma_pagamento="pix",
    data_inicio="2026-01-01T00:00:00",
    data_fim=None,
    ativo=True,
):
    return {
        "descricao": descricao,
        "valor": valor,
        "dia_vencimento": dia_vencimento,
        "categoria_id": categoria_id,
        "subcategoria_id": subcategoria_id,
        "natureza": natureza,
        "forma_pagamento": forma_pagamento,
        "data_inicio": data_inicio,
        "data_fim": data_fim,
        "ativo": ativo,
    }
