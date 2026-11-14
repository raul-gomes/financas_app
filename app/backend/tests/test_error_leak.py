"""Internal exception text must never reach the HTTP client (pendencias S9)."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.exc import SQLAlchemyError

from app.db.repositories.category import CategoriaRepository
from app.db.repositories.limits import LimitsRepository
from app.db.repositories.recurring_account import ContaRecorrenteRepository
from app.db.repositories.shopping import ShoppingRepository
from app.db.repositories.transaction import TransacaoRepository
from app.main import app

LEAK_MARKER = "leak-marker-db-host-10.0.0.9"
GENERIC_500 = "Erro interno"

TRANSACTION_PAYLOAD = {
    "amount": 10.0,
    "description": "x",
    "transaction_date": "2026-01-15T10:00:00",
    "type": "expense",
    "entity_type": "individual",
    "payment_method": "pix",
    "category_name": "Leak",
    "subcategory_name": "Leak",
}


@pytest.fixture
async def tolerant_client(client):
    """Client that turns unhandled server errors into 500 responses (like production)."""
    transport = ASGITransport(app=app, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


def _boom(exc: Exception):
    """Async stand-in that raises `exc` whatever the arguments."""

    async def raiser(*_args, **_kwargs):
        raise exc

    return raiser


def _assert_generic(response) -> None:
    assert response.status_code == 500
    assert LEAK_MARKER not in response.text
    assert GENERIC_500 in response.text


@pytest.mark.parametrize("exc", [RuntimeError(LEAK_MARKER), SQLAlchemyError(LEAK_MARKER)])
async def test_create_transaction_does_not_leak(tolerant_client, monkeypatch, exc):
    monkeypatch.setattr(TransacaoRepository, "create", _boom(exc))
    _assert_generic(await tolerant_client.post("/transacoes/", json=TRANSACTION_PAYLOAD))


@pytest.mark.parametrize("exc", [RuntimeError(LEAK_MARKER), SQLAlchemyError(LEAK_MARKER)])
async def test_generate_shopping_does_not_leak(tolerant_client, monkeypatch, exc):
    monkeypatch.setattr(ShoppingRepository, "generate_recurring_items", _boom(exc))
    payload = {"start_month": "2026-01-01", "end_month": "2026-02-01"}
    _assert_generic(await tolerant_client.post("/shopping/generate-recurring", json=payload))


@pytest.mark.parametrize("exc", [RuntimeError(LEAK_MARKER), SQLAlchemyError(LEAK_MARKER)])
async def test_generate_recurring_does_not_leak(tolerant_client, monkeypatch, exc):
    monkeypatch.setattr(ContaRecorrenteRepository, "generate_pending_transactions", _boom(exc))
    payload = {"start_date": "2026-01-01T00:00:00", "end_date": "2026-02-01T00:00:00"}
    _assert_generic(await tolerant_client.post("/recurring-accounts/generate", json=payload))


async def test_bulk_limits_item_errors_do_not_leak(tolerant_client, monkeypatch):
    monkeypatch.setattr(CategoriaRepository, "create", _boom(SQLAlchemyError(LEAK_MARKER)))
    payload = {"new": [{"category_name": "Nova", "entity_type": "individual", "limit": 1}]}
    response = await tolerant_client.put("/limits/", json=payload)
    assert LEAK_MARKER not in response.text
    assert response.json()["errors"]


async def test_bulk_limits_commit_failure_does_not_leak(tolerant_client, monkeypatch):
    async def failing_commit(self):
        raise SQLAlchemyError(LEAK_MARKER)

    monkeypatch.setattr(LimitsRepository, "_create_new_category", _boom(ValueError("dup")))
    monkeypatch.setattr("sqlalchemy.ext.asyncio.AsyncSession.commit", failing_commit)
    payload = {"new": [{"category_name": "Nova", "entity_type": "individual", "limit": 1}]}
    _assert_generic(await tolerant_client.put("/limits/", json=payload))


async def test_unhandled_error_gets_generic_message(tolerant_client, monkeypatch):
    monkeypatch.setattr(CategoriaRepository, "get_all", _boom(RuntimeError(LEAK_MARKER)))
    response = await tolerant_client.get("/categories/")
    assert response.status_code == 500
    assert LEAK_MARKER not in response.text
    assert GENERIC_500 in response.text
