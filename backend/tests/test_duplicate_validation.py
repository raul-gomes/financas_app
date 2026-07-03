import pytest
from datetime import datetime, date

from app.schemas.transaction import (
    DuplicateCheckRequest, DuplicateCheckResponse,
    SingleDuplicateCheckItem,
    ResolveDuplicatesRequest, DuplicateResolution,
)


class TestCheckDuplicates:
    """Tests for POST /transacoes/check-duplicates"""

    async def test_single_no_duplicate(self, client):
        """Single check — no existing transaction matches"""
        resp = await client.post(
            "/transacoes/check-duplicates",
            json={"transaction_date": "2026-07-01", "amount": 999.99},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) == 1
        assert data["results"][0]["has_duplicate"] is False
        assert data["results"][0]["duplicates"] == []

    async def test_single_with_duplicate(self, client):
        """Single check — finds matching transaction"""
        # First create a transaction
        create_resp = await client.post(
            "/transacoes/",
            json={
                "amount": 150.0,
                "description": "Teste duplicata",
                "transaction_date": "2026-06-15T10:00:00",
                "type": "expense",
                "entity_type": "individual",
                "payment_method": "pix",
                "category_name": "Alimentacao",
                "subcategory_name": "Supermercado",
            },
        )
        assert create_resp.status_code == 201

        # Now check duplicate
        resp = await client.post(
            "/transacoes/check-duplicates",
            json={"transaction_date": "2026-06-15", "amount": 150.0},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) == 1
        assert data["results"][0]["has_duplicate"] is True
        assert len(data["results"][0]["duplicates"]) == 1
        assert data["results"][0]["duplicates"][0]["amount"] == 150.0

    async def test_single_different_date_no_duplicate(self, client):
        """Same value, different date — should NOT be duplicate"""
        await client.post(
            "/transacoes/",
            json={
                "amount": 200.0,
                "description": "Teste data diferente",
                "transaction_date": "2026-06-15T10:00:00",
                "type": "expense",
                "entity_type": "individual",
                "payment_method": "pix",
                "category_name": "Alimentacao",
                "subcategory_name": "Supermercado",
            },
        )

        resp = await client.post(
            "/transacoes/check-duplicates",
            json={"transaction_date": "2026-06-16", "amount": 200.0},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["results"][0]["has_duplicate"] is False

    async def test_single_different_value_no_duplicate(self, client):
        """Same date, different value — should NOT be duplicate"""
        await client.post(
            "/transacoes/",
            json={
                "amount": 100.0,
                "description": "Teste valor diferente",
                "transaction_date": "2026-06-15T10:00:00",
                "type": "expense",
                "entity_type": "individual",
                "payment_method": "pix",
                "category_name": "Alimentacao",
                "subcategory_name": "Supermercado",
            },
        )

        resp = await client.post(
            "/transacoes/check-duplicates",
            json={"transaction_date": "2026-06-15", "amount": 999.99},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["results"][0]["has_duplicate"] is False

    async def test_bulk_check(self, client):
        """Bulk check with multiple transactions"""
        # Create two transactions
        await client.post(
            "/transacoes/",
            json={
                "amount": 50.0,
                "description": "Bulk 1",
                "transaction_date": "2026-06-10T10:00:00",
                "type": "expense",
                "entity_type": "individual",
                "payment_method": "pix",
                "category_name": "Alimentacao",
                "subcategory_name": "Supermercado",
            },
        )
        await client.post(
            "/transacoes/",
            json={
                "amount": 75.0,
                "description": "Bulk 2",
                "transaction_date": "2026-06-11T10:00:00",
                "type": "expense",
                "entity_type": "individual",
                "payment_method": "pix",
                "category_name": "Alimentacao",
                "subcategory_name": "Supermercado",
            },
        )

        resp = await client.post(
            "/transacoes/check-duplicates",
            json={
                "transactions": [
                    {"index": 0, "transaction_date": "2026-06-10", "amount": 50.0},
                    {"index": 1, "transaction_date": "2026-06-11", "amount": 75.0},
                    {"index": 2, "transaction_date": "2026-06-12", "amount": 999.99},
                ]
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["results"]) == 3
        assert data["results"][0]["has_duplicate"] is True
        assert data["results"][1]["has_duplicate"] is True
        assert data["results"][2]["has_duplicate"] is False

    async def test_bulk_empty(self, client):
        """Bulk check with empty list"""
        resp = await client.post(
            "/transacoes/check-duplicates",
            json={"transactions": []},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["results"] == []

    async def test_invalid_request_no_fields(self, client):
        """Missing all fields should return 400"""
        resp = await client.post(
            "/transacoes/check-duplicates",
            json={},
        )
        assert resp.status_code == 400


class TestResolveDuplicates:
    """Tests for POST /transacoes/resolve-duplicates"""

    async def test_keep_both(self, client):
        """keep_both — no deletion happens"""
        # Create a real transaction
        create_resp = await client.post(
            "/transacoes/",
            json={
                "amount": 250.0,
                "description": "Keep both test",
                "transaction_date": "2026-06-18T10:00:00",
                "type": "expense",
                "entity_type": "individual",
                "payment_method": "pix",
                "category_name": "Alimentacao",
                "subcategory_name": "Supermercado",
            },
        )
        existing_id = create_resp.json()["id"]

        new_resp = await client.post(
            "/transacoes/",
            json={
                "amount": 250.0,
                "description": "Keep both new",
                "transaction_date": "2026-06-18T10:00:00",
                "type": "expense",
                "entity_type": "individual",
                "payment_method": "pix",
                "category_name": "Alimentacao",
                "subcategory_name": "Supermercado",
            },
        )
        new_id = new_resp.json()["id"]

        resp = await client.post(
            "/transacoes/resolve-duplicates",
            json={
                "resolutions": [
                    {"new_id": new_id, "existing_id": existing_id, "action": "keep_both"}
                ]
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["resolved"] == 1
        assert data["deleted"] == 0
        assert data["kept"] == 1

        # Both should still exist
        get1 = await client.get(f"/transacoes/{existing_id}")
        get2 = await client.get(f"/transacoes/{new_id}")
        assert get1.status_code == 200
        assert get2.status_code == 200

    async def test_keep_new_deletes_existing(self, client):
        """keep_new — deletes the existing transaction"""
        # First create a transaction to delete
        create_resp = await client.post(
            "/transacoes/",
            json={
                "amount": 300.0,
                "description": "To be deleted",
                "transaction_date": "2026-06-20T10:00:00",
                "type": "expense",
                "entity_type": "individual",
                "payment_method": "pix",
                "category_name": "Alimentacao",
                "subcategory_name": "Supermercado",
            },
        )
        existing_id = create_resp.json()["id"]

        # Create the "new" transaction
        new_resp = await client.post(
            "/transacoes/",
            json={
                "amount": 300.0,
                "description": "The new one",
                "transaction_date": "2026-06-20T10:00:00",
                "type": "expense",
                "entity_type": "individual",
                "payment_method": "pix",
                "category_name": "Alimentacao",
                "subcategory_name": "Supermercado",
            },
        )
        new_id = new_resp.json()["id"]

        # Resolve: keep the new one, delete the existing
        resp = await client.post(
            "/transacoes/resolve-duplicates",
            json={
                "resolutions": [
                    {"new_id": new_id, "existing_id": existing_id, "action": "keep_new"}
                ]
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["resolved"] == 1
        assert data["deleted"] == 1

        # Verify the existing was deleted
        get_resp = await client.get(f"/transacoes/{existing_id}")
        assert get_resp.status_code == 404

    async def test_keep_existing_deletes_new(self, client):
        """keep_existing — deletes the new transaction"""
        create_resp = await client.post(
            "/transacoes/",
            json={
                "amount": 400.0,
                "description": "Keep me",
                "transaction_date": "2026-06-25T10:00:00",
                "type": "expense",
                "entity_type": "individual",
                "payment_method": "pix",
                "category_name": "Alimentacao",
                "subcategory_name": "Supermercado",
            },
        )
        existing_id = create_resp.json()["id"]

        new_resp = await client.post(
            "/transacoes/",
            json={
                "amount": 400.0,
                "description": "Delete me",
                "transaction_date": "2026-06-25T10:00:00",
                "type": "expense",
                "entity_type": "individual",
                "payment_method": "pix",
                "category_name": "Alimentacao",
                "subcategory_name": "Supermercado",
            },
        )
        new_id = new_resp.json()["id"]

        resp = await client.post(
            "/transacoes/resolve-duplicates",
            json={
                "resolutions": [
                    {"new_id": new_id, "existing_id": existing_id, "action": "keep_existing"}
                ]
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["resolved"] == 1
        assert data["deleted"] == 1

        # Verify the new was deleted
        get_resp = await client.get(f"/transacoes/{new_id}")
        assert get_resp.status_code == 404

        # Verify the existing remains
        get_resp = await client.get(f"/transacoes/{existing_id}")
        assert get_resp.status_code == 200
