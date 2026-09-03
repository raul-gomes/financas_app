import pytest
from httpx import AsyncClient


async def _criar_transacao(clients_ctrl, user_id: int, nome: str, descricao: str = "Compras",
                           amount: float = 50.0) -> int:
    """Cria uma transação via category_name (auto-cria categoria+subcategoria)."""
    clients_ctrl.switch(user_id)
    resp = await clients_ctrl.post("/transacoes/", json={
        "amount": amount,
        "description": descricao,
        "transaction_date": "2026-01-15T10:00:00",
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_name": nome,
        "subcategory_name": "Sub1",
    })
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


class TestTransacaoIsolamento:
    """Etapa 6 — cada usuário vê só suas transações."""

    async def test_user2_nao_ve_transacoes_do_user1(self, clients_ctrl):
        tx1_id = await _criar_transacao(clients_ctrl, 1, "CategoriaUser1")
        clients_ctrl.switch(2)
        resp = await clients_ctrl.get("/transacoes/")
        assert resp.status_code == 200
        assert all(t["id"] != tx1_id for t in resp.json())

    async def test_user2_nao_consegue_buscar_por_id_transacao_do_user1(self, clients_ctrl):
        tx1_id = await _criar_transacao(clients_ctrl, 1, "CategoriaUser1b")
        clients_ctrl.switch(2)
        resp = await clients_ctrl.get(f"/transacoes/{tx1_id}")
        assert resp.status_code == 404

    async def test_user2_nao_consegue_atualizar_transacao_do_user1(self, clients_ctrl):
        tx1_id = await _criar_transacao(clients_ctrl, 1, "CategoriaUser1c")
        clients_ctrl.switch(2)
        resp = await clients_ctrl.put(f"/transacoes/{tx1_id}", json={"amount": 999.0})
        assert resp.status_code == 404

    async def test_user2_nao_consegue_deletar_transacao_do_user1(self, clients_ctrl):
        tx1_id = await _criar_transacao(clients_ctrl, 1, "CategoriaUser1d")
        clients_ctrl.switch(2)
        resp = await clients_ctrl.delete(f"/transacoes/{tx1_id}")
        assert resp.status_code == 404

    async def test_check_duplicates_respeita_usuario(self, clients_ctrl):
        # User 1 cria transação
        await _criar_transacao(clients_ctrl, 1, "CategoriaUser1e")

        # User 2 não vê duplicata (mesma data e valor não são do user 2)
        clients_ctrl.switch(2)
        resp = await clients_ctrl.post(
            "/transacoes/check-duplicates",
            json={"transaction_date": "2026-01-15", "amount": 50.0},
        )
        assert resp.status_code == 200
        assert resp.json()["results"][0]["has_duplicate"] is False

    async def test_user2_nao_ve_transacao_no_extrato(self, clients_ctrl):
        tx1_id = await _criar_transacao(clients_ctrl, 1, "CategoriaUser1f")
        clients_ctrl.switch(2)
        resp = await clients_ctrl.get("/dashboard/statement?start_date=01/01/2026&end_date=31/01/2026&entity_type=individual")
        assert resp.status_code == 200
        assert all(t["id"] != tx1_id for t in resp.json()["transactions"])

    async def test_user2_nao_ve_transacao_no_export_csv(self, clients_ctrl):
        await _criar_transacao(clients_ctrl, 1, "CategoriaUser1g")
        clients_ctrl.switch(2)
        resp = await clients_ctrl.get("/export/csv?start_date=01/01/2026&end_date=31/01/2026")
        assert resp.status_code == 200
        assert b"Compras" not in resp.content