import pytest
from app.services.extract_parsers import parse_csv, parse_ofx


def test_parse_csv_valid_data():
    csv_content = "data,descricao,valor\n01/01/2026,Compra,100.50\n02/01/2026,Mercado,250.75"
    result = parse_csv(csv_content)
    assert len(result) == 2
    assert result[0]['date'] == '01/01/2026'
    assert result[0]['description'] == 'Compra'
    assert result[0]['amount'] == 100.50
    assert result[0]['type'] == 'income'


def test_parse_csv_saida_valor_negativo():
    csv_content = "data,descricao,valor\n01/01/2026,Compra,-100.50"
    result = parse_csv(csv_content)
    assert len(result) == 1
    assert result[0]['type'] == 'expense'
    assert result[0]['amount'] == 100.50


def test_parse_csv_with_semicolon_delimiter():
    csv_content = "data;descricao;valor\n01/01/2026;Compra;-100.50"
    result = parse_csv(csv_content)
    assert len(result) == 1
    assert result[0]['amount'] == 100.50
    assert result[0]['type'] == 'expense'


def test_parse_csv_with_header_row():
    csv_content = "Data;Descricao;Valor\n01/01/2026;Compra;-100.50"
    result = parse_csv(csv_content)
    assert len(result) == 1
    assert result[0]['date'] == '01/01/2026'


def test_parse_csv_empty_data():
    result = parse_csv("")
    assert result == []


def test_parse_csv_only_headers():
    csv_content = "data,descricao,valor"
    result = parse_csv(csv_content)
    assert result == []


def test_parse_csv_with_iso_date():
    csv_content = "data,descricao,valor\n2026-01-15,Compra,-50.00"
    result = parse_csv(csv_content)
    assert len(result) == 1
    assert result[0]['date'] == '15/01/2026'


def test_parse_csv_with_tab_delimiter():
    csv_content = "data\tdescricao\tvalor\n01/01/2026\tCompra\t-100.00"
    result = parse_csv(csv_content)
    assert len(result) == 1
    assert result[0]['amount'] == 100.00


def test_parse_csv_skips_incomplete_rows():
    csv_content = "data,descricao,valor\n01/01/2026,Compra,\n,Missing Date,-50.00"
    result = parse_csv(csv_content)
    assert len(result) == 0


def test_parse_csv_amount_with_currency_symbol():
    csv_content = "data,descricao,valor\n01/01/2026,Compra,-R$ 150.00"
    result = parse_csv(csv_content)
    assert len(result) == 1
    assert result[0]['amount'] == 150.00
