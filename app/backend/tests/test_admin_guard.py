import pytest


class TestAdminGuard:
    """Etapa 9 — rotas protegidas por require_admin retornam 403 para role='user'."""

    # (método, path, payload, observação do módulo)
    ADMIN_ENDPOINTS = [
        ("GET", "/pluggy/accounts", None),
        ("GET", "/export/csv", None),
        ("GET", "/export/ofx", None),
        ("GET", "/shopping/?month=2026-06-01", None),
        ("GET", "/goals/", None),
        ("POST", "/extracts/upload", {}),
    ]

    async def _call(self, client, method, path, payload):
        if method == "GET":
            return await client.get(path)
        if method == "POST":
            return await client.post(path, json=payload)
        raise AssertionError(f"método não suportado: {method}")

    @pytest.mark.parametrize("method,path,payload", ADMIN_ENDPOINTS)
    async def test_user_role_gets_403(self, clients_ctrl, method, path, payload):
        clients_ctrl.switch(3)  # user 3 = role='user'
        resp = await self._call(clients_ctrl, method, path, payload)
        assert resp.status_code == 403, f"{method} {path} retornou {resp.status_code} p/ user"

    async def test_user_role_can_access_recurring_accounts(self, clients_ctrl):
        # user 3 = role='user' tem acesso a limites/recorrentes
        clients_ctrl.switch(3)
        resp = await clients_ctrl.get("/recurring-accounts/")
        assert resp.status_code == 200, f"GET /recurring-accounts/ retornou {resp.status_code} p/ user"

    async def test_user_role_cannot_generate_recurring(self, clients_ctrl):
        # generate cria transações em massa — permanece admin-only (Financial só chama p/ admin)
        clients_ctrl.switch(3)
        resp = await clients_ctrl.post("/recurring-accounts/generate", json={
            "start_date": "2026-06-01T00:00:00",
            "end_date": "2026-06-30T00:00:00",
        })
        assert resp.status_code == 403, f"POST /recurring-accounts/generate retornou {resp.status_code} p/ user"

    async def test_admin_role_not_blocked_on_dashboard(self, clients_ctrl):
        # user 1 = role='admin' não leva 403 numa rota comum
        clients_ctrl.switch(1)
        resp = await clients_ctrl.get("/shopping/?month=2026-06-01")
        assert resp.status_code == 200