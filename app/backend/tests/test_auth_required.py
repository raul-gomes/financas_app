import pytest

from httpx import AsyncClient


# Etapa 4: todas as rotas protegidas com Depends(get_current_user).
# Sem token / token inválido → 401. Usamos client_no_auth (SEM override do auth).


@pytest.mark.asyncio
async def test_transacoes_list_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.get("/transacoes/")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_transacoes_create_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.post("/transacoes/", json={})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_check_duplicates_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.post("/transacoes/check-duplicates", json={})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_resolve_duplicates_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.post("/transacoes/resolve-duplicates", json={"resolutions": []})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_categories_list_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.get("/categories/")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_categories_create_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.post("/categories/", json={})
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_dashboard_statement_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.get("/dashboard/statement?start_date=01/01/2026&end_date=31/01/2026")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_dashboard_period_income_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.get("/dashboard/period-income?year=2026")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_dashboard_category_options_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.get("/dashboard/category-options")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_limits_list_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.get("/limits/")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_limits_with_spending_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.get("/limits/with-spending?year=2026&month=1")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_recurring_accounts_list_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.get("/recurring-accounts/")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_extract_upload_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.post("/extracts/upload")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_settings_profile_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.get("/settings/profile")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_settings_banks_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.get("/settings/banks")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_goals_list_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.get("/goals/")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_shopping_list_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.get("/shopping/?month=2026-01-01")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_pluggy_accounts_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.get("/pluggy/accounts")
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_export_csv_requires_auth(client_no_auth: AsyncClient):
    resp = await client_no_auth.get("/export/csv")
    assert resp.status_code == 401