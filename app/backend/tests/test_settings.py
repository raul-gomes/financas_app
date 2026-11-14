"""Testes dos endpoints de /settings — foco nos bancos do usuário
(consumidos pelo componente BankSelect do frontend)."""

import pytest


def bank_payload(bank_code="260", bank_name="Nubank"):
    return {"bank_code": bank_code, "bank_name": bank_name}


@pytest.mark.asyncio
async def test_list_banks_starts_empty(client):
    resp = await client.get("/settings/banks")
    assert resp.status_code == 200
    assert resp.json() == []


@pytest.mark.asyncio
async def test_add_bank_creates_and_lists(client):
    create = await client.post("/settings/banks", json=bank_payload())
    assert create.status_code == 201
    body = create.json()
    assert body["bank_code"] == "260"
    assert body["bank_name"] == "Nubank"
    assert "id" in body

    listed = await client.get("/settings/banks")
    assert listed.status_code == 200
    banks = listed.json()
    assert len(banks) == 1
    assert banks[0]["id"] == body["id"]
    assert "created_at" in banks[0]


@pytest.mark.asyncio
async def test_add_bank_requires_code_and_name(client):
    resp = await client.post("/settings/banks", json={"bank_code": "260"})
    assert resp.status_code == 422

    resp = await client.post("/settings/banks", json={"bank_name": "Nubank"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_remove_bank_then_404(client):
    created = (await client.post("/settings/banks", json=bank_payload("341", "Itaú"))).json()

    deleted = await client.delete(f"/settings/banks/{created['id']}")
    assert deleted.status_code == 204

    again = await client.delete(f"/settings/banks/{created['id']}")
    assert again.status_code == 404

    listed = await client.get("/settings/banks")
    assert listed.json() == []


@pytest.mark.asyncio
async def test_remove_bank_not_found_returns_404(client):
    resp = await client.delete("/settings/banks/9999")
    assert resp.status_code == 404


@pytest.mark.asyncio
async def test_profile_roundtrip_name_update(client):
    get = await client.get("/settings/profile")
    assert get.status_code == 200
    original = get.json()
    assert "id" in original and "name" in original

    update = await client.put(
        "/settings/profile",
        json={"name": "Nome Teste"},
    )
    assert update.status_code == 200
    assert update.json()["name"] == "Nome Teste"

    restored = await client.put(
        "/settings/profile",
        json={"name": original["name"]},
    )
    assert restored.status_code == 200


@pytest.mark.asyncio
async def test_profile_includes_role(client):
    get = await client.get("/settings/profile")
    assert get.status_code == 200
    body = get.json()
    # Usuário padrão (seed single-user) deve ser admin por padrão
    assert "role" in body
    assert body["role"] == "admin"


# ── Perfil: segredos e identidade (pendencias S2, S4) ───────────────


@pytest.mark.asyncio
async def test_profile_never_returns_the_pluggy_key(client):
    saved = await client.put("/settings/profile", json={"pluggy_api_key": "pluggy-secret-123456"})
    assert saved.status_code == 200
    assert "pluggy_api_key" not in saved.json()
    assert saved.json()["has_pluggy_key"] is True

    body = (await client.get("/settings/profile")).json()
    assert "pluggy_api_key" not in body
    assert body["has_pluggy_key"] is True
    assert "pluggy-secret-123456" not in str(body)


@pytest.mark.asyncio
async def test_profile_reports_missing_pluggy_key(client):
    body = (await client.get("/settings/profile")).json()
    assert body["has_pluggy_key"] is False


@pytest.mark.asyncio
async def test_pluggy_key_can_be_removed_with_empty_string(client):
    await client.put("/settings/profile", json={"pluggy_api_key": "pluggy-secret-123456"})
    removed = await client.put("/settings/profile", json={"pluggy_api_key": ""})
    assert removed.json()["has_pluggy_key"] is False


@pytest.mark.asyncio
@pytest.mark.parametrize("field", ["email", "password"])
async def test_profile_rejects_email_and_password_changes(client, field):
    """E-mail e senha pertencem ao Supabase; o app não guarda cópia."""
    response = await client.put("/settings/profile", json={field: "x@example.com"})
    assert response.status_code == 422
