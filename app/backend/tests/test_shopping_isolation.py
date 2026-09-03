import pytest
from datetime import date


MES = "2026-06-01"


async def _criar_item(clients_ctrl, user_id: int, nome: str) -> int:
    clients_ctrl.switch(user_id)
    resp = await clients_ctrl.post("/shopping/", json={
        "name": nome,
        "reference_month": MES,
    })
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


class TestShoppingIsolamento:
    """Etapa 8 — cada usuário vê só sua lista de compras."""

    async def test_user2_nao_ve_itens_do_user1(self, clients_ctrl):
        await _criar_item(clients_ctrl, 1, "NotebookU1")
        clients_ctrl.switch(2)
        resp = await clients_ctrl.get(f"/shopping/?month={MES}")
        assert resp.status_code == 200
        assert len(resp.json()) == 0

    async def test_user2_nao_consegue_atualizar_item_do_user1(self, clients_ctrl):
        item_id = await _criar_item(clients_ctrl, 1, "MouseU1")
        clients_ctrl.switch(2)
        resp = await clients_ctrl.put(f"/shopping/{item_id}", json={"checked": True})
        assert resp.status_code == 404

    async def test_user2_nao_consegue_deletar_item_do_user1(self, clients_ctrl):
        item_id = await _criar_item(clients_ctrl, 1, "TecladoU1")
        clients_ctrl.switch(2)
        resp = await clients_ctrl.delete(f"/shopping/{item_id}")
        assert resp.status_code == 404

    async def test_migrate_respeita_usuario(self, clients_ctrl):
        """Migração só copia itens não-marcados do usuário atual."""
        await _criar_item(clients_ctrl, 1, "FeiraU1")
        # User 2 também tem um item não-marcado no mês de origem
        await _criar_item(clients_ctrl, 2, "FeiraU2")

        # User 1 migra -> só migra o item dele (1), não o do user 2
        clients_ctrl.switch(1)
        resp = await clients_ctrl.post(f"/shopping/migrate?source_month={MES}&target_month=2026-07-01")
        assert resp.status_code == 200
        assert resp.json()["count"] == 1

        # User 2 migra -> só migra o item dele (1), não o do user 1
        clients_ctrl.switch(2)
        resp = await clients_ctrl.post(f"/shopping/migrate?source_month={MES}&target_month=2026-07-01")
        assert resp.status_code == 200
        assert resp.json()["count"] == 1