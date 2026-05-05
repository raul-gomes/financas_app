import pytest
from app.schemas.transacao import (
    TransacaoCreate, TransacaoUpdate,
    TipoTransacao, NaturezaTransacao, TipoPagamento
)
from app.schemas.categorias import Categoria, CategoriaCreate, CategoriaUpdate
from app.schemas.subcategoria import Subcategoria, SubcategoriaCreate, SubcategoriaUpdate
from app.schemas.conta_recorrente import (
    ContaRecorrenteCreate, ContaRecorrenteUpdate,
    GenerateRequest, GenerateResponse
)
from app.schemas.extracto import (
    ParsedTransaction, UploadResponse, ConfirmTransaction, ConfirmPayload, ConfirmResponse
)
from app.schemas.limits import (
    SubcategoriaLimiteUpdate, CategoriaLimiteUpdate,
    LimitsUpdatePayload, LimitsUpdateResponse
)
from datetime import datetime
import pytest


class TestTransacaoCreate:
    def test_valid_transacao(self):
        t = TransacaoCreate(
            valor=100.0,
            descricao="Test",
            data_transacao=datetime(2026, 1, 15),
            tipo=TipoTransacao.SAIDA,
            natureza=NaturezaTransacao.PF,
            forma_pagamento=TipoPagamento.PIX,
            categoria_nome="Food",
            subcategoria_nome="Grocery"
        )
        assert t.valor == 100.0

    def test_valor_must_be_positive(self):
        with pytest.raises(Exception):
            TransacaoCreate(
                valor=-50.0, descricao="Test", data_transacao=datetime(2026, 1, 15),
                tipo=TipoTransacao.SAIDA, natureza=NaturezaTransacao.PF,
                forma_pagamento=TipoPagamento.PIX, categoria_nome="X", subcategoria_nome="Y"
            )

    def test_valor_zero_invalid(self):
        with pytest.raises(Exception):
            TransacaoCreate(
                valor=0, descricao="Test", data_transacao=datetime(2026, 1, 15),
                tipo=TipoTransacao.SAIDA, natureza=NaturezaTransacao.PF,
                forma_pagamento=TipoPagamento.PIX, categoria_nome="X", subcategoria_nome="Y"
            )

    def test_categoria_required(self):
        with pytest.raises(Exception):
            TransacaoCreate(
                valor=100.0, descricao="Test", data_transacao=datetime(2026, 1, 15),
                tipo=TipoTransacao.SAIDA, natureza=NaturezaTransacao.PF,
                forma_pagamento=TipoPagamento.PIX
            )

    def test_subcategoria_required(self):
        with pytest.raises(Exception):
            TransacaoCreate(
                valor=100.0, descricao="Test", data_transacao=datetime(2026, 1, 15),
                tipo=TipoTransacao.SAIDA, natureza=NaturezaTransacao.PF,
                forma_pagamento=TipoPagamento.PIX, categoria_nome="X"
            )


class TestTransacaoUpdate:
    def test_all_fields_optional(self):
        u = TransacaoUpdate()
        assert u.valor is None

    def test_partial_update(self):
        u = TransacaoUpdate(valor=200.0, descricao="Updated")
        assert u.valor == 200.0

    def test_valor_must_be_positive(self):
        with pytest.raises(Exception):
            TransacaoUpdate(valor=-10.0)


class TestCategoriaCreate:
    def test_valid_categoria(self):
        c = CategoriaCreate(
            categoria_nome="Food", natureza="pf", limite=500.0,
            subcategorias=[SubcategoriaCreate(subcategoria_nome="Grocery")]
        )
        assert c.categoria_nome == "Food"
        assert len(c.subcategorias) == 1

    def test_categoria_no_subcategorias(self):
        c = CategoriaCreate(categoria_nome="Food", natureza="pf", limite=500.0)
        assert c.subcategorias == []

    def test_limite_zero_valid(self):
        c = CategoriaCreate(categoria_nome="Food", natureza="pf", limite=0)
        assert c.limite == 0


class TestContaRecorrenteCreate:
    def test_valid_conta(self):
        c = ContaRecorrenteCreate(
            descricao="Rent", valor=1500.0, dia_vencimento=10,
            categoria_id=1, subcategoria_id=1,
            natureza="pf", forma_pagamento="pix",
            data_inicio=datetime(2026, 1, 1)
        )
        assert c.descricao == "Rent"
        assert c.ativo is True

    def test_valor_must_be_positive(self):
        with pytest.raises(Exception):
            ContaRecorrenteCreate(
                descricao="Rent", valor=-100.0, dia_vencimento=10,
                categoria_id=1, subcategoria_id=1,
                natureza="pf", forma_pagamento="pix",
                data_inicio=datetime(2026, 1, 1)
            )

    def test_dia_vencimento_range(self):
        with pytest.raises(Exception):
            ContaRecorrenteCreate(
                descricao="Rent", valor=100.0, dia_vencimento=32,
                categoria_id=1, subcategoria_id=1,
                natureza="pf", forma_pagamento="pix",
                data_inicio=datetime(2026, 1, 1)
            )

    def test_dia_vencimento_zero_invalid(self):
        with pytest.raises(Exception):
            ContaRecorrenteCreate(
                descricao="Rent", valor=100.0, dia_vencimento=0,
                categoria_id=1, subcategoria_id=1,
                natureza="pf", forma_pagamento="pix",
                data_inicio=datetime(2026, 1, 1)
            )


class TestContaRecorrenteUpdate:
    def test_all_optional(self):
        u = ContaRecorrenteUpdate()
        assert u.descricao is None

    def test_toggle_ativo(self):
        u = ContaRecorrenteUpdate(ativo=False)
        assert u.ativo is False


class TestExtractoSchemas:
    def test_parsed_transaction(self):
        p = ParsedTransaction(data="01/01/2026", descricao="Test", valor=100.0, tipo="saida")
        assert p.categoria_id is None

    def test_upload_response(self):
        u = UploadResponse(total=2, entradas=1, saidas=1, total_entradas=500.0, total_saidas=200.0, transacoes=[])
        assert u.total == 2

    def test_confirm_transaction(self):
        c = ConfirmTransaction(
            data="01/01/2026", descricao="Test", valor=100.0, tipo="saida",
            categoria_id=1, subcategoria_id=1
        )
        assert c.forma_pagamento == "pix"
        assert c.natureza == "pf"

    def test_confirm_payload(self):
        p = ConfirmPayload(transacoes=[])
        assert len(p.transacoes) == 0

    def test_confirm_response(self):
        r = ConfirmResponse(criadas=5, erros=["err1"])
        assert r.criadas == 5
        assert len(r.erros) == 1


class TestLimitsSchemas:
    def test_limits_update_payload(self):
        p = LimitsUpdatePayload(
            new=[CategoriaLimiteUpdate(categoria_nome="New", natureza="pf", limite=100.0)],
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
            data_inicio=datetime(2026, 1, 1),
            data_final=datetime(2026, 12, 31)
        )
        assert r.data_inicio.year == 2026

    def test_generate_response(self):
        r = GenerateResponse(geradas=3, detalhes=["Bill 1", "Bill 2"])
        assert r.geradas == 3
