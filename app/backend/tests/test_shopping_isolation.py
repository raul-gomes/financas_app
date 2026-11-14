import pytest


MES = "2026-06-01"


async def _criar_item(clients_ctrl, user_id: int, nome: str) -> int:
    clients_ctrl.switch(user_id)
    resp = await clients_ctrl.post(
        "/shopping/",
        json={
            "name": nome,
            "reference_month": MES,
        },
    )
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
