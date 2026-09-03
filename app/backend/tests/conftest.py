import asyncio
import pytest
import pytest_asyncio
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.db.base import Base
from app.core.database import get_session
from app.core.security import get_current_user
from app.db.models.user import UserORM

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
async def async_session():
    async with TestSessionLocal() as session:
        yield session


@pytest_asyncio.fixture
async def client():
    async with TestSessionLocal() as session:
        async def override_get_session():
            yield session

        app.dependency_overrides[get_session] = override_get_session

        # Usuário de teste para os testes legados (single-user global).
        # A Etapa 4 (proteger rotas) adiciona Depends(get_current_user) em
        # todas as rotas; este override injeta um usuário fake para que os
        # testes existentes continuem exercendo a lógica de negócio.
        # Testes específicos de auth (401 sem token) usam um client sem override.
        now = datetime.now(timezone.utc)
        fake_user = UserORM(
            id=1,
            name="Teste",
            email="teste@teste.com",
            password_hash="",
            role="admin",
            created_at=now,
            updated_at=now,
        )
        session.add(fake_user)
        await session.flush()

        async def override_get_current_user() -> UserORM:
            return fake_user

        app.dependency_overrides[get_current_user] = override_get_current_user

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c

        app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client_no_auth():
    """Cliente SEM override de auth: sem token até o Depends → 401.

    A Etapa 4 protege todas as rotas com Depends(get_current_user). Este
    client é usado nos testes que verificam que endpoints retornam 401 sem
    credenciais válidas.
    """
    async with TestSessionLocal() as session:
        async def override_get_session():
            yield session

        app.dependency_overrides[get_session] = override_get_session

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c

        app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client_user2():
    """Cliente autenticado como um SEGUNDO usuário (id=2).

    NOTA: como `app.dependency_overrides[get_current_user]` é global, não use
    `client` e `client_user2` simultaneamente no mesmo teste — o override do
    último fixture a ser configurado vence para todas as requisições. Para
    testes que precisam alternar entre usuários, use `clients_ctrl`.
    """
    async with TestSessionLocal() as session:
        async def override_get_session():
            yield session

        app.dependency_overrides[get_session] = override_get_session

        now = datetime.now(timezone.utc)
        fake_user2 = UserORM(
            id=2,
            name="Teste2",
            email="teste2@teste.com",
            password_hash="",
            role="user",
            created_at=now,
            updated_at=now,
        )
        session.add(fake_user2)
        await session.flush()

        async def override_get_current_user() -> UserORM:
            return fake_user2

        app.dependency_overrides[get_current_user] = override_get_current_user

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            yield c

        app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def clients_ctrl():
    """Cliente HTTP com controle de troca de usuário autenticado.

    Cria no mesmo banco:
      - user 1 (role='admin')
      - user 2 (role='admin')  — para provar isolamento de dados entre admins
      - user 3 (role='user')   — para provar os guards (403) das rotas de admin

    Expõe `switch(user_id)` para alternar o `get_current_user`. Ideal para
    testar isolamento de dados por usuário via HTTP sem conflito de overrides globais.
    """
    async with TestSessionLocal() as session:
        async def override_get_session():
            yield session

        app.dependency_overrides[get_session] = override_get_session

        now = datetime.now(timezone.utc)
        users = {
            1: UserORM(id=1, name="Admin1", email="admin1@teste.com", password_hash="", role="admin", created_at=now, updated_at=now),
            2: UserORM(id=2, name="Admin2", email="admin2@teste.com", password_hash="", role="admin", created_at=now, updated_at=now),
            3: UserORM(id=3, name="Comum3", email="comum3@teste.com", password_hash="", role="user", created_at=now, updated_at=now),
        }
        for u in users.values():
            session.add(u)
        await session.flush()

        current_id = {"value": 1}

        async def override_get_current_user() -> UserORM:
            return users[current_id["value"]]

        app.dependency_overrides[get_current_user] = override_get_current_user

        def switch(user_id: int):
            current_id["value"] = user_id

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            c.switch = switch  # type: ignore[attr-defined]
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
