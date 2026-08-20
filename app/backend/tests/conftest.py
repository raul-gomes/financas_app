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


def categoria_payload(name="Alimentacao", entity_type="individual", limit=1000.0, subs=None):
    return {
        "category_name": name,
        "entity_type": entity_type,
        "limit": limit,
        "subcategories": subs or [{"subcategory_name": "Supermercado"}],
    }


def transacao_payload(
    amount=50.0,
    description="Compras",
    transaction_date="2026-01-15T10:00:00",
    tipo="expense",
    entity_type="individual",
    payment_method="pix",
    category_id=None,
    category_name="Alimentacao",
    subcategory_id=None,
    subcategory_name="Supermercado",
):
    return {
        "amount": amount,
        "description": description,
        "transaction_date": transaction_date,
        "type": tipo,
        "entity_type": entity_type,
        "payment_method": payment_method,
        "category_id": category_id,
        "category_name": category_name,
        "subcategory_id": subcategory_id,
        "subcategory_name": subcategory_name,
    }


def conta_recorrente_payload(
    description="Aluguel",
    amount=1500.0,
    due_day=10,
    category_id=1,
    subcategory_id=1,
    entity_type="individual",
    payment_method="pix",
    start_date="2026-01-01T00:00:00",
    end_date=None,
    active=True,
):
    return {
        "description": description,
        "amount": amount,
        "due_day": due_day,
        "category_id": category_id,
        "subcategory_id": subcategory_id,
        "entity_type": entity_type,
        "payment_method": payment_method,
        "start_date": start_date,
        "end_date": end_date,
        "active": active,
    }
