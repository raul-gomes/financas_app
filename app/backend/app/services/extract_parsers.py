import csv
import io
import re
import xml.etree.ElementTree as ET
from datetime import datetime
from typing import List, Dict, Any


def parse_csv(content: str, delimiter: str = None) -> List[Dict[str, Any]]:
    lines = content.strip().split('\n')
    if not lines:
        return []

    if delimiter is None:
        delimiter = _detect_delimiter(lines[0])

    reader = csv.DictReader(io.StringIO(content), delimiter=delimiter)
    rows = list(reader)

    col_map = _map_csv_columns(rows[0] if rows else {})

    transactions = []
    for row in rows:
        try:
            date_str = row.get(col_map['date'], '')
            amount_str = row.get(col_map['amount'], '')
            description = row.get(col_map['description'], '')

            if not date_str or not amount_str:
                continue

            date = _parse_date(date_str)
            amount = _parse_amount(amount_str)
            trans_type = 'expense' if amount < 0 else 'income'

            transactions.append({
                'date': date.strftime('%d/%m/%Y'),
                'description': description or 'Sem descricao',
                'amount': abs(amount),
                'type': trans_type,
            })
        except Exception:
            continue

    return transactions


def parse_ofx(content: str) -> List[Dict[str, Any]]:
    transactions = []

    cleaned = _clean_ofx_tags(content)

    try:
        root = ET.fromstring(cleaned)
    except ET.ParseError:
        try:
            wrapped = f'<OFX>{cleaned}</OFX>'
            root = ET.fromstring(wrapped)
        except ET.ParseError:
            return []

    stmt_trns = root.findall('.//STMTTRN')

    for stmt_trn in stmt_trns:
        try:
            dtposted = _get_text(stmt_trn, 'DTPOSTED')
            trnamt = _get_text(stmt_trn, 'TRNAMT')
            memo = _get_text(stmt_trn, 'MEMO', '')
            name = _get_text(stmt_trn, 'NAME', '')

            if not dtposted or not trnamt:
                continue

            date = datetime.strptime(dtposted, '%Y%m%d')
            amount = float(trnamt)
            trans_type = 'expense' if amount < 0 else 'income'
            description = memo or name or 'Sem descricao'

            transactions.append({
                'date': date.strftime('%d/%m/%Y'),
                'description': description,
                'amount': abs(amount),
                'type': trans_type,
            })
        except Exception:
            continue

    return transactions


def _detect_delimiter(line: str) -> str:
    if ';' in line:
        return ';'
    if '\t' in line:
        return '\t'
    return ','


def _map_csv_columns(first_row: Dict[str, str]) -> Dict[str, str]:
    col_map = {'date': '', 'amount': '', 'description': ''}

    date_patterns = ['data', 'date', 'dt', 'data_transacao', 'data da transacao']
    amount_patterns = ['valor', 'amount', 'value', 'total', 'vlr', 'valor_transacao']
    desc_patterns = ['descricao', 'description', 'desc', 'memo', 'historico', 'detalhe', 'nome']

    for key in first_row.keys():
        key_lower = key.lower().strip()
        for p in date_patterns:
            if p in key_lower:
                col_map['date'] = key
                break
        for p in amount_patterns:
            if p in key_lower:
                col_map['amount'] = key
                break
        for p in desc_patterns:
            if p in key_lower:
                col_map['description'] = key
                break

    if not col_map['date'] and first_row:
        keys = list(first_row.keys())
        col_map['date'] = keys[0] if len(keys) > 0 else ''
        col_map['amount'] = keys[1] if len(keys) > 1 else ''
        col_map['description'] = keys[2] if len(keys) > 2 else keys[1] if len(keys) > 1 else ''

    return col_map


def _parse_date(date_str: str) -> datetime:
    date_str = date_str.strip()

    formats = [
        '%d/%m/%Y',
        '%Y-%m-%d',
        '%d-%m-%Y',
        '%m/%d/%Y',
        '%d%m%Y',
        '%Y%m%d',
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt)
        except ValueError:
            continue

    match = re.search(r'(\d{2})[/-](\d{2})[/-](\d{4})', date_str)
    if match:
        d, m, y = match.groups()
        try:
            return datetime(int(y), int(m), int(d))
        except ValueError:
            return datetime(int(y), int(d), int(m))

    match = re.search(r'(\d{4})[/-](\d{2})[/-](\d{2})', date_str)
    if match:
        y, m, d = match.groups()
        return datetime(int(y), int(m), int(d))

    raise ValueError(f'Data nao reconhecida: {date_str}')


def _parse_amount(amount_str: str) -> float:
    amount_str = amount_str.strip()
    amount_str = amount_str.replace('R$', '').replace(' ', '')

    if ',' in amount_str and '.' in amount_str:
        if amount_str.rfind(',') > amount_str.rfind('.'):
            amount_str = amount_str.replace('.', '').replace(',', '.')
        else:
            amount_str = amount_str.replace(',', '')
    elif ',' in amount_str:
        amount_str = amount_str.replace(',', '.')

    return float(amount_str)


def _clean_ofx_tags(content: str) -> str:
    content = re.sub(r'(\w+)>', r'\1></\1>', content)
    content = re.sub(r'</(\w+)><\1>', '', content)
    return content


def _get_text(element: ET.Element, tag: str, default: str = '') -> str:
    child = element.find(tag)
    if child is not None and child.text:
        return child.text.strip()
    return default
