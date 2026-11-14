import csv
import html
import io
import re
from datetime import datetime
from typing import Any
from xml.etree.ElementTree import Element
from xml.sax.saxutils import escape as xml_escape

from defusedxml import ElementTree as SafeET
from defusedxml.common import DefusedXmlException

from app.logger import logger


class UnsafeOfxError(ValueError):
    """Raised when an OFX document uses forbidden XML constructs (entities, DTD tricks)."""


def parse_csv(content: str, delimiter: str | None = None) -> list[dict[str, Any]]:
    lines = content.strip().split("\n")
    if not lines:
        return []

    if delimiter is None:
        delimiter = _detect_delimiter(lines[0])

    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
    rows = list(reader)

    col_map = _map_csv_columns(rows[0] if rows else {})

    transactions = []
    for line_number, row in enumerate(rows, start=2):  # line 1 is the header
        try:
            date_str = row.get(col_map["date"], "")
            amount_str = row.get(col_map["amount"], "")
            description = row.get(col_map["description"], "")

            if not date_str or not amount_str:
                continue

            date = _parse_date(date_str)
            amount = _parse_amount(amount_str)
            trans_type = "expense" if amount < 0 else "income"

            transactions.append(
                {
                    "date": date.strftime("%d/%m/%Y"),
                    "description": description or "Sem descricao",
                    "amount": abs(amount),
                    "type": trans_type,
                }
            )
        except (KeyError, ValueError, TypeError) as exc:
            logger.warning(f"CSV line {line_number} skipped: {type(exc).__name__}")

    return transactions


def parse_ofx(content: str) -> list[dict[str, Any]]:
    """Parse OFX content with defusedxml.

    Raises:
        UnsafeOfxError: the document declares entities or other forbidden XML constructs.
    """
    transactions = []

    if _FORBIDDEN_XML.search(content):
        raise UnsafeOfxError("OFX com construções XML não permitidas")
    cleaned = _clean_ofx_tags(content)

    try:
        root = SafeET.fromstring(cleaned)
    except DefusedXmlException as exc:
        raise UnsafeOfxError("OFX com construções XML não permitidas") from exc
    except SafeET.ParseError:
        try:
            wrapped = f"<OFX>{cleaned}</OFX>"
            root = SafeET.fromstring(wrapped)
        except DefusedXmlException as exc:
            raise UnsafeOfxError("OFX com construções XML não permitidas") from exc
        except SafeET.ParseError:
            return []

    stmt_trns = root.findall(".//STMTTRN")

    for position, stmt_trn in enumerate(stmt_trns, start=1):
        try:
            dtposted = _get_text(stmt_trn, "DTPOSTED")
            trnamt = _get_text(stmt_trn, "TRNAMT")
            memo = _get_text(stmt_trn, "MEMO", "")
            name = _get_text(stmt_trn, "NAME", "")

            if not dtposted or not trnamt:
                continue

            date = datetime.strptime(dtposted[:OFX_DATE_LENGTH], "%Y%m%d")
            amount = float(trnamt.replace(",", "."))
            trans_type = "expense" if amount < 0 else "income"
            description = memo or name or "Sem descricao"

            transactions.append(
                {
                    "date": date.strftime("%d/%m/%Y"),
                    "description": description,
                    "amount": abs(amount),
                    "type": trans_type,
                }
            )
        except (ValueError, TypeError) as exc:
            logger.warning(f"OFX transaction #{position} skipped: {type(exc).__name__}")

    return transactions


def _detect_delimiter(line: str) -> str:
    if ";" in line:
        return ";"
    if "\t" in line:
        return "\t"
    return ","


def _map_csv_columns(first_row: dict[str, str]) -> dict[str, str]:
    col_map = {"date": "", "amount": "", "description": ""}

    date_patterns = ["data", "date", "dt", "data_transacao", "data da transacao"]
    amount_patterns = ["valor", "amount", "value", "total", "vlr", "valor_transacao"]
    desc_patterns = ["descricao", "description", "desc", "memo", "historico", "detalhe", "nome"]

    for key in first_row:
        key_lower = key.lower().strip()
        for p in date_patterns:
            if p in key_lower:
                col_map["date"] = key
                break
        for p in amount_patterns:
            if p in key_lower:
                col_map["amount"] = key
                break
        for p in desc_patterns:
            if p in key_lower:
                col_map["description"] = key
                break

    if not col_map["date"] and first_row:
        keys = list(first_row.keys())
        col_map["date"] = keys[0] if len(keys) > 0 else ""
        col_map["amount"] = keys[1] if len(keys) > 1 else ""
        col_map["description"] = keys[2] if len(keys) > 2 else keys[1] if len(keys) > 1 else ""

    return col_map


def _parse_date(date_str: str) -> datetime:
    date_str = date_str.strip()

    formats = [
        "%d/%m/%Y",
        "%Y-%m-%d",
        "%d-%m-%Y",
        "%m/%d/%Y",
        "%d%m%Y",
        "%Y%m%d",
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue

    match = re.search(r"(\d{2})[/-](\d{2})[/-](\d{4})", date_str)
    if match:
        d, m, y = match.groups()
        try:
            return datetime(int(y), int(m), int(d))
        except ValueError:
            return datetime(int(y), int(d), int(m))

    match = re.search(r"(\d{4})[/-](\d{2})[/-](\d{2})", date_str)
    if match:
        y, m, d = match.groups()
        return datetime(int(y), int(m), int(d))

    raise ValueError(f"Data nao reconhecida: {date_str}")


def _parse_amount(amount_str: str) -> float:
    amount_str = amount_str.strip()
    amount_str = amount_str.replace("R$", "").replace(" ", "")

    if "," in amount_str and "." in amount_str:
        if amount_str.rfind(",") > amount_str.rfind("."):
            amount_str = amount_str.replace(".", "").replace(",", ".")
        else:
            amount_str = amount_str.replace(",", "")
    elif "," in amount_str:
        amount_str = amount_str.replace(",", ".")

    return float(amount_str)


# DTD and entity declarations are never part of a bank OFX (entity-expansion attacks).
_FORBIDDEN_XML = re.compile(r"<!(DOCTYPE|ENTITY)", re.IGNORECASE)
OFX_DATE_LENGTH = 8  # DTPOSTED starts with YYYYMMDD; time and [tz] may follow
# A leaf element whose value is not followed by its own closing tag (SGML OFX 1.x).
_UNCLOSED_LEAF = re.compile(r"<(\w+)>([^<\s][^<]*?)\s*(?=<(?!/\1>))")


def _clean_ofx_tags(content: str) -> str:
    """Turn OFX 1.x (SGML) or 2.x (XML) into well-formed XML.

    Drops the header block and any ``<?...?>`` declarations, then closes leaf
    elements that SGML leaves open (``<TRNAMT>-50.00`` → ``<TRNAMT>-50.00</TRNAMT>``),
    escaping their text. Elements that are already closed are left untouched.
    """
    start = content.find("<OFX>")
    body = content[start:] if start >= 0 else content

    def close_leaf(match: re.Match[str]) -> str:
        tag, value = match.group(1), html.unescape(match.group(2).strip())
        return f"<{tag}>{xml_escape(value)}</{tag}>"

    return _UNCLOSED_LEAF.sub(close_leaf, body)


def _get_text(element: Element, tag: str, default: str = "") -> str:
    child = element.find(tag)
    if child is not None and child.text:
        return child.text.strip()
    return default
