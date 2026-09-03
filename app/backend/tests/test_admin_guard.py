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
        ("GET", "/recurring-accounts/", None),
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

    async def test_admin_role_not_blocked_on_dashboard(self, clients_ctrl):
        # user 1 = role='admin' não leva 403 numa rota comum
        clients_ctrl.switch(1)
        resp = await clients_ctrl.get("/shopping/?month=2026-06-01")
        assert resp.status_code == 200