"""OFX parsing with real-world layouts (SGML 1.x from Brazilian banks and XML 2.x)."""

from app.services.extract_parsers import parse_ofx

SGML_OFX = """OFXHEADER:100
DATA:OFXSGML
VERSION:102
SECURITY:NONE
ENCODING:USASCII
CHARSET:1252

<OFX>
<SIGNONMSGSRSV1><SONRS><STATUS><CODE>0<SEVERITY>INFO</STATUS></SONRS></SIGNONMSGSRSV1>
<BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<DTSTART>20260101
<STMTTRN>
<TRNTYPE>DEBIT
<DTPOSTED>20260105120000[-3:BRT]
<TRNAMT>-50.00
<FITID>1
<MEMO>Padaria & Cia
</STMTTRN>
<STMTTRN>
<TRNTYPE>CREDIT
<DTPOSTED>20260110
<TRNAMT>1500,00
<FITID>2
<NAME>Salario
</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>
"""

XML_OFX = """<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220"?>
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT</TRNTYPE><DTPOSTED>20260203</DTPOSTED><TRNAMT>-12.34</TRNAMT><MEMO>Cafe &amp; Pao</MEMO></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>
"""


def test_parses_sgml_ofx_from_brazilian_banks() -> None:
    result = parse_ofx(SGML_OFX)

    assert result == [
        {"date": "05/01/2026", "description": "Padaria & Cia", "amount": 50.0, "type": "expense"},
        {"date": "10/01/2026", "description": "Salario", "amount": 1500.0, "type": "income"},
    ]


def test_parses_xml_ofx_2() -> None:
    result = parse_ofx(XML_OFX)

    assert result == [
        {"date": "03/02/2026", "description": "Cafe & Pao", "amount": 12.34, "type": "expense"},
    ]


def test_ofx_without_transactions_returns_empty_list() -> None:
    assert parse_ofx("OFXHEADER:100\n\n<OFX></OFX>") == []
