"""pt-BR amount parsing used by the transactions text search."""

from decimal import Decimal

import pytest

from app.core.br_number import parse_br_amount


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("120", Decimal("120")),
        ("120,5", Decimal("120.5")),
        ("120,50", Decimal("120.50")),
        ("1.234,56", Decimal("1234.56")),
        ("1.234", Decimal("1234")),
        ("12.345.678,9", Decimal("12345678.9")),
        ("  R$ 1.234,56 ", Decimal("1234.56")),
        ("r$120", Decimal("120")),
        ("120.50", Decimal("120.50")),
        ("0,99", Decimal("0.99")),
        ("0", Decimal("0")),
    ],
)
def test_valid_pt_br_amounts_are_parsed(text, expected):
    assert parse_br_amount(text) == expected


@pytest.mark.parametrize(
    "text",
    [
        "",
        "   ",
        "abc",
        "12a",
        "mercado 120",
        ",",
        ",50",
        "1,2,3",
        "1.2.3",
        "1,234.56",
        "120,555",
        "-120",
        "12 000",
        "1" * 20,
        "%",
    ],
)
def test_non_numeric_or_ambiguous_text_is_ignored(text):
    assert parse_br_amount(text) is None
