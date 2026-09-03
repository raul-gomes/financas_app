import pytest


async def _criar_categoria_e_conta(clients_ctrl, user_id: int, descricao: str,
                                   amount: float = 100.0) -> int:
    """Cria categoria+subcategoria e uma conta recorrente para o usuário."""
    clients_ctrl.switch(user_id)
    # Cria categoria (e subcategoria) para o usuário
    cat_resp = await clients_ctrl.post("/categories/", json={
        "category_name": f"Cat_{descricao}",
        "entity_type": "individual",
        "limit": 0,
        "subcategories": [{"subcategory_name": "Sub1"}],
    })
    assert cat_resp.status_code == 201, cat_resp.text
    # Busca subcategoria via category-options
    opts = await clients_ctrl.get("/dashboard/category-options")
    opt = next((c for c in opts.json()["options"] if c["name"] == f"Cat_{descricao}"), None)
    sub_id = opt["subcategories"][0]["id"] if opt and opt["subcategories"] else None

    resp = await clients_ctrl.post("/recurring-accounts/", json={
        "description": descricao,
        "amount": amount,
        "due_day": 10,
        "category_id": cat_resp.json()["id"],
        "subcategory_id": sub_id,
        "entity_type": "individual",
        "payment_method": "pix",
        "start_date": "2026-01-01T00:00:00",
        "active": True,
    })
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


class TestContaRecorrenteIsolamento:
    """Etapa 7 — cada usuário vê só suas contas recorrentes."""

    async def test_user2_nao_ve_contas_do_user1(self, clients_ctrl):
        conta_id = await _criar_categoria_e_conta(clients_ctrl, 1, "AluguelU1")
        clients_ctrl.switch(2)
        resp = await clients_ctrl.get("/recurring-accounts/")
        assert resp.status_code == 200
        assert all(c["id"] != conta_id for c in resp.json())

    async def test_user2_nao_consegue_buscar_conta_do_user1(self, clients_ctrl):
        conta_id = await _criar_categoria_e_conta(clients_ctrl, 1, "AluguelU1b")
        clients_ctrl.switch(2)
        resp = await clients_ctrl.get(f"/recurring-accounts/{conta_id}")
        assert resp.status_code == 404

    async def test_user2_nao_consegue_atualizar_conta_do_user1(self, clients_ctrl):
        conta_id = await _criar_categoria_e_conta(clients_ctrl, 1, "AluguelU1c")
        clients_ctrl.switch(2)
        resp = await clients_ctrl.put(f"/recurring-accounts/{conta_id}", json={"amount": 999.0})
        assert resp.status_code == 404

    async def test_user2_nao_consegue_deletar_conta_do_user1(self, clients_ctrl):
        conta_id = await _criar_categoria_e_conta(clients_ctrl, 1, "AluguelU1d")
        clients_ctrl.switch(2)
        resp = await clients_ctrl.delete(f"/recurring-accounts/{conta_id}")
        assert resp.status_code == 404

    async def test_user2_nao_consegue_renovar_conta_do_user1(self, clients_ctrl):
        conta_id = await _criar_categoria_e_conta(clients_ctrl, 1, "AluguelU1e")
        clients_ctrl.switch(2)
        resp = await clients_ctrl.post(f"/recurring-accounts/{conta_id}/renew")
        assert resp.status_code == 404

    async def test_transacoes_geradas_pertencem_ao_user(self, clients_ctrl):
        """Generate de um user cria transações que não vazam para outro user."""
        conta_id = await _criar_categoria_e_conta(clients_ctrl, 1, "AluguelU1f")
        # User 1 renova para gerar parcelas
        clients_ctrl.switch(1)
        resp = await clients_ctrl.post(f"/recurring-accounts/{conta_id}/renew")
        assert resp.status_code == 200

        # As transações geradas do user 1 devem ser visíveis na listagem do user 1
        list_tx_u1 = await clients_ctrl.get("/transacoes/")
        assert list_tx_u1.status_code == 200
        assert len(list_tx_u1.json()) >= 1

        # User 2 não deve ver nenhuma transação (isolamento por user_id)
        clients_ctrl.switch(2)
        list_tx_u2 = await clients_ctrl.get("/transacoes/")
        assert list_tx_u2.status_code == 200
        assert len(list_tx_u2.json()) == 0