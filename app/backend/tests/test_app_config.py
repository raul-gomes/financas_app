import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import DEFAULT_CORS_ORIGINS, parse_cors_origins
from app.main import create_app


def test_parse_cors_origins_default_when_unset():
    assert parse_cors_origins(None) == list(DEFAULT_CORS_ORIGINS)
    assert parse_cors_origins("  , ") == list(DEFAULT_CORS_ORIGINS)


def test_parse_cors_origins_splits_and_strips():
    raw = "https://a.example.com, https://b.example.com ,"
    assert parse_cors_origins(raw) == ["https://a.example.com", "https://b.example.com"]


async def _get(app, path, **headers):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        return await c.get(path, headers=headers)


@pytest.mark.asyncio
async def test_cors_allows_configured_origin_only():
    app = create_app(environment="development", cors_origins=["https://app.example.com"])
    ok = await _get(app, "/health", Origin="https://app.example.com")
    bad = await _get(app, "/health", Origin="https://evil.example.com")
    assert ok.headers.get("access-control-allow-origin") == "https://app.example.com"
    assert "access-control-allow-origin" not in bad.headers


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
async def test_docs_disabled_in_production(path):
    app = create_app(environment="production", cors_origins=[])
    assert (await _get(app, path)).status_code == 404


@pytest.mark.asyncio
@pytest.mark.parametrize("path", ["/docs", "/redoc", "/openapi.json"])
async def test_docs_enabled_in_development(path):
    app = create_app(environment="development", cors_origins=[])
    assert (await _get(app, path)).status_code == 200
