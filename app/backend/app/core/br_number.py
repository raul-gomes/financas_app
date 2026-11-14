"""Parsing of pt-BR formatted amounts typed by users (``1.234,56``).

Only unambiguous forms are accepted; anything else is "not an amount" (``None``) so callers can
ignore it instead of guessing.
"""

import re
from decimal import Decimal

CURRENCY_PREFIX = re.compile(r"^r\$\s*", re.IGNORECASE)
# 120 | 120,5 | 120,50
PLAIN_PT_BR = re.compile(r"^\d+(,\d{1,2})?$")
# 1.234 | 1.234,56 | 12.345.678,9 (thousands groups of exactly three digits)
GROUPED_PT_BR = re.compile(r"^\d{1,3}(\.\d{3})+(,\d{1,2})?$")
# 120.50 | 1.5 (a single dot followed by one or two digits cannot be a thousands group)
DOT_DECIMAL = re.compile(r"^\d+\.\d{1,2}$")
MAX_INTEGER_DIGITS = 15  # beyond this no real amount exists and float conversion loses cents


def parse_br_amount(text: str) -> Decimal | None:
    """Parses a typed amount in pt-BR notation, or returns ``None`` when it is not one.

    Accepts an optional ``R$`` prefix, ``.`` as thousands separator and ``,`` as decimal
    separator (up to two decimals). A lone dot with one or two digits after it (``120.50``) is
    read as a decimal point. Signs, spaces inside the number, US notation (``1,234.56``) and
    more than two decimals are rejected.
    """
    cleaned = CURRENCY_PREFIX.sub("", text.strip()).strip()
    if PLAIN_PT_BR.match(cleaned):
        normalized = cleaned.replace(",", ".")
    elif GROUPED_PT_BR.match(cleaned):
        normalized = cleaned.replace(".", "").replace(",", ".")
    elif DOT_DECIMAL.match(cleaned):
        normalized = cleaned
    else:
        return None

    if len(normalized.split(".")[0]) > MAX_INTEGER_DIGITS:
        return None
    return Decimal(normalized)
