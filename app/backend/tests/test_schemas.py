import pytest
from app.schemas.transaction import (
    TransacaoCreate, TransacaoUpdate,
    TipoTransacao, NaturezaTransacao, TipoPagamento
)
from app.schemas.categories import Categoria, CategoriaCreate, CategoriaUpdate
from app.schemas.subcategory import Subcategoria, SubcategoriaCreate, SubcategoriaUpdate
from app.schemas.recurring_account import (
    ContaRecorrenteCreate, ContaRecorrenteUpdate,
    GenerateRequest, GenerateResponse
)
from app.schemas.extract import (
    ParsedTransaction, UploadResponse, ConfirmTransaction, ConfirmPayload, ConfirmResponse
)
from app.schemas.limits import (
    SubcategoriaLimiteUpdate, CategoriaLimiteUpdate,
    LimitsUpdatePayload, LimitsUpdateResponse
)
from datetime import datetime


class TestTransacaoCreate:
    def test_valid_transacao(self):
        t = TransacaoCreate(
            amount=100.0,
            description="Test",
            transaction_date=datetime(2026, 1, 15),
            type=TipoTransacao.SAIDA,
            entity_type=NaturezaTransacao.PF,
            payment_method=TipoPagamento.PIX,
            category_name="Food",
            subcategory_name="Grocery"
        )
        assert t.amount == 100.0

    def test_valor_must_be_positive(self):
        with pytest.raises(Exception):
            TransacaoCreate(
                amount=-50.0, description="Test", transaction_date=datetime(2026, 1, 15),
                type=TipoTransacao.SAIDA, entity_type=NaturezaTransacao.PF,
                payment_method=TipoPagamento.PIX, category_name="X", subcategory_name="Y"
            )

    def test_valor_zero_invalid(self):
        with pytest.raises(Exception):
            TransacaoCreate(
                amount=0, description="Test", transaction_date=datetime(2026, 1, 15),
                type=TipoTransacao.SAIDA, entity_type=NaturezaTransacao.PF,
                payment_method=TipoPagamento.PIX, category_name="X", subcategory_name="Y"
            )

    def test_categoria_required(self):
        with pytest.raises(Exception):
            TransacaoCreate(
                amount=100.0, description="Test", transaction_date=datetime(2026, 1, 15),
                type=TipoTransacao.SAIDA, entity_type=NaturezaTransacao.PF,
                payment_method=TipoPagamento.PIX
            )

    def test_subcategoria_required(self):
        with pytest.raises(Exception):
            TransacaoCreate(
                amount=100.0, description="Test", transaction_date=datetime(2026, 1, 15),
                type=TipoTransacao.SAIDA, entity_type=NaturezaTransacao.PF,
                payment_method=TipoPagamento.PIX, category_name="X"
            )


class TestTransacaoUpdate:
    def test_all_fields_optional(self):
        u = TransacaoUpdate()
        assert u.amount is None

    def test_partial_update(self):
        u = TransacaoUpdate(amount=200.0, description="Updated")
        assert u.amount == 200.0

    def test_valor_must_be_positive(self):
        with pytest.raises(Exception):
            TransacaoUpdate(amount=-10.0)


class TestCategoriaCreate:
    def test_valid_categoria(self):
        c = CategoriaCreate(
            category_name="Food", entity_type="individual", limit=500.0,
            subcategories=[SubcategoriaCreate(subcategory_name="Grocery")]
        )
        assert c.category_name == "Food"
        assert len(c.subcategories) == 1

    def test_categoria_no_subcategorias(self):
        c = CategoriaCreate(category_name="Food", entity_type="individual", limit=500.0)
        assert c.subcategories == []

    def test_limite_zero_valid(self):
        c = CategoriaCreate(category_name="Food", entity_type="individual", limit=0)
        assert c.limit == 0


class TestContaRecorrenteCreate:
    def test_valid_conta(self):
        c = ContaRecorrenteCreate(
            description="Rent", amount=1500.0, due_day=10,
            category_id=1, subcategory_id=1,
            entity_type="individual", payment_method="pix",
            start_date=datetime(2026, 1, 1)
        )
        assert c.description == "Rent"
        assert c.active is True

    def test_valor_must_be_positive(self):
        with pytest.raises(Exception):
            ContaRecorrenteCreate(
                description="Rent", amount=-100.0, due_day=10,
                category_id=1, subcategory_id=1,
                entity_type="individual", payment_method="pix",
                start_date=datetime(2026, 1, 1)
            )

    def test_dia_vencimento_range(self):
        with pytest.raises(Exception):
            ContaRecorrenteCreate(
                description="Rent", amount=100.0, due_day=32,
                category_id=1, subcategory_id=1,
                entity_type="individual", payment_method="pix",
                start_date=datetime(2026, 1, 1)
            )

    def test_dia_vencimento_zero_invalid(self):
        with pytest.raises(Exception):
            ContaRecorrenteCreate(
                description="Rent", amount=100.0, due_day=0,
                category_id=1, subcategory_id=1,
                entity_type="individual", payment_method="pix",
                start_date=datetime(2026, 1, 1)
            )


class TestContaRecorrenteUpdate:
    def test_all_optional(self):
        u = ContaRecorrenteUpdate()
        assert u.description is None

    def test_toggle_ativo(self):
        u = ContaRecorrenteUpdate(active=False)
        assert u.active is False


class TestExtractoSchemas:
    def test_parsed_transaction(self):
        p = ParsedTransaction(date="01/01/2026", description="Test", amount=100.0, type="expense")
        assert p.category_id is None

    def test_upload_response(self):
        u = UploadResponse(total=2, total_income=1, total_expenses=1, total_income_amount=500.0, total_expenses_amount=200.0, transactions=[])
        assert u.total == 2

    def test_confirm_transaction(self):
        c = ConfirmTransaction(
            date="01/01/2026", description="Test", amount=100.0, type="expense",
            category_id=1, subcategory_id=1
        )
        assert c.payment_method == "pix"
        assert c.entity_type == "individual"

    def test_confirm_payload(self):
        p = ConfirmPayload(transactions=[])
        assert len(p.transactions) == 0

    def test_confirm_response(self):
        r = ConfirmResponse(created=5, errors=["err1"])
        assert r.created == 5
        assert len(r.errors) == 1


class TestLimitsSchemas:
    def test_limits_update_payload(self):
        p = LimitsUpdatePayload(
            new=[CategoriaLimiteUpdate(category_name="New", entity_type="individual", limit=100.0)],
            modified=[]
        )
        assert len(p.new) == 1

    def test_limits_update_response(self):
        r = LimitsUpdateResponse(
            success=True, message="OK", created_categories=1,
            updated_categories=0, created_subcategories=2,
            updated_subcategories=0
        )
        assert r.success is True
        assert r.created_categories == 1


class TestGenerateRequestResponse:
    def test_generate_request(self):
        r = GenerateRequest(
            start_date=datetime(2026, 1, 1),
            end_date=datetime(2026, 12, 31)
        )
        assert r.start_date.year == 2026

    def test_generate_response(self):
        r = GenerateResponse(generated=3, details=["Bill 1", "Bill 2"])
        assert r.generated == 3
