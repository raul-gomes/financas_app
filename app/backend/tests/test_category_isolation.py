import pytest
import pytest_asyncio
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_category_isolation_across_users(clients_ctrl):
    """Categoria criada pelo usuário 2 não aparece na listagem do usuário 1."""
    # Usuário 2 cria uma categoria
    clients_ctrl.switch(2)
    resp2 = await clients_ctrl.post("/categories/", json={
        "category_name": "CategoriaSecreta",
        "entity_type": "individual",
        "limit": 500.0,
        "subcategories": [{"subcategory_name": "SubSecreta"}],
    })
    assert resp2.status_code == 201
    cat2_id = resp2.json()["id"]

    # Usuário 1 NÃO deve ver essa categoria
    clients_ctrl.switch(1)
    resp1 = await clients_ctrl.get("/categories/")
    assert resp1.status_code == 200
    names1 = [c["category_name"] for c in resp1.json()]
    assert "CategoriaSecreta" not in names1

    # Usuário 1 não deve conseguir buscar a categoria do usuário 2 por ID
    resp1_get = await clients_ctrl.get(f"/categories/{cat2_id}")
    assert resp1_get.status_code == 404


@pytest.mark.asyncio
async def test_category_isolation_reverse(clients_ctrl):
    """Categoria criada pelo usuário 1 não aparece na listagem do usuário 2."""
    clients_ctrl.switch(1)
    resp1 = await clients_ctrl.post("/categories/", json={
        "category_name": "CategoriaDoUsuario1",
        "entity_type": "individual",
        "limit": 500.0,
        "subcategories": [],
    })
    assert resp1.status_code == 201
    cat1_id = resp1.json()["id"]

    clients_ctrl.switch(2)
    resp2 = await clients_ctrl.get("/categories/")
    assert resp2.status_code == 200
    names2 = [c["category_name"] for c in resp2.json()]
    assert "CategoriaDoUsuario1" not in names2

    resp2_get = await clients_ctrl.get(f"/categories/{cat1_id}")
    assert resp2_get.status_code == 404


@pytest.mark.asyncio
async def test_same_category_name_allowed_across_users(clients_ctrl):
    """Dois usuários podem ter categorias com o mesmo nome (unicidade é por usuário)."""
    payload = {
        "category_name": "Alimentacao",
        "entity_type": "individual",
        "limit": 1000.0,
        "subcategories": [],
    }
    clients_ctrl.switch(1)
    r1 = await clients_ctrl.post("/categories/", json=payload)
    assert r1.status_code == 201

    clients_ctrl.switch(2)
    r2 = await clients_ctrl.post("/categories/", json=payload)
    assert r2.status_code == 201


@pytest.mark.asyncio
async def test_user_cannot_update_or_delete_other_users_category(clients_ctrl):
    clients_ctrl.switch(2)
    resp2 = await clients_ctrl.post("/categories/", json={
        "category_name": "DeOutro",
        "entity_type": "individual",
        "limit": 300.0,
        "subcategories": [{"subcategory_name": "SubOutro"}],
    })
    assert resp2.status_code == 201
    cat2_id = resp2.json()["id"]

    # Usuário 1 tenta atualizar a categoria do usuário 2
    clients_ctrl.switch(1)
    r_upd = await clients_ctrl.put(f"/categories/{cat2_id}", json={"category_name": "Hackeado"})
    assert r_upd.status_code == 404

    # Usuário 1 tenta excluir a categoria do usuário 2
    r_del = await clients_ctrl.delete(f"/categories/{cat2_id}")
    assert r_del.status_code == 404

    # A categoria continua existindo para o usuário 2
    clients_ctrl.switch(2)
    still = await clients_ctrl.get(f"/categories/{cat2_id}")
    assert still.status_code == 200
    assert still.json()["category_name"] == "DeOutro"


@pytest.mark.asyncio
async def test_subcategory_cannot_be_reached_across_users(clients_ctrl):
    """Subcategorias de uma categoria de outro usuário não devem ser acessíveis."""
    clients_ctrl.switch(2)
    resp2 = await clients_ctrl.post("/categories/", json={
        "category_name": "CatComSub",
        "entity_type": "individual",
        "limit": 300.0,
        "subcategories": [{"subcategory_name": "SubPrivada"}],
    })
    assert resp2.status_code == 201
    cat2_id = resp2.json()["id"]

    # Usuário 1 tenta criar uma transação apontando para a categoria do usuário 2
    clients_ctrl.switch(1)
    r_tx = await clients_ctrl.post("/transacoes/", json={
        "amount": 50.0,
        "description": "Intrusao",
        "transaction_date": "2026-01-15T10:00:00",
        "type": "expense",
        "entity_type": "individual",
        "payment_method": "pix",
        "category_id": cat2_id,
        "subcategory_name": "SubPrivada",
    })
    assert r_tx.status_code == 400  # categoria não encontrada para o usuário 1