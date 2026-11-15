"""Export service: CSV and OFX files of the authenticated user's transactions.

Layering (see AGENTS.md): route -> service -> repository. The routes are admin-only (guard on
the router); the query is scoped by ``user.id`` from the verified token. Read-only: nothing to
commit. The clock is injectable (``now``) so the output is reproducible in tests.
"""

import csv
import io
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.transaction import TransactionORM
from app.db.models.user import UserORM
from app.db.repositories.export import ExportRepository

BR_DATE_FORMAT = "%d/%m/%Y"
FILENAME_DATE_FORMAT = "%Y%m%d"
OFX_DATE_FORMAT = "%Y%m%d"
CSV_MEDIA_TYPE = "text/csv"
OFX_MEDIA_TYPE = "application/x-ofx"
OFX_MEMO_MAX_LENGTH = 255
EXPENSE_TYPE = "expense"
CSV_HEADER = [
    "Data",
    "Descrição",
    "Valor",
    "Tipo",
    "Natureza",
    "Forma Pagamento",
    "Categoria",
    "Subcategoria",
    "Banco",
    "Parcela",
    "Total Parcelas",
]
OFX_PROLOGUE = [
    "OFXHEADER:100",
    "DATA:OFXSGML",
    "VERSION:102",
    "SECURITY:NONE",
    "ENCODING:UTF-8",
    "CHARSET:UNICODE",
    "",
    "<OFX>",
    "  <SIGNONMSGSRSV1>",
    "    <SONRS>",
    "      <STATUS>",
    "        <CODE>0</CODE>",
    "        <SEVERITY>INFO</SEVERITY>",
    "      </STATUS>",
]
OFX_BANK_HEADER = [
    "      <LANGUAGE>POR</LANGUAGE>",
    "    </SONRS>",
    "  </SIGNONMSGSRSV1>",
    "  <BANKMSGSRSV1>",
    "    <STMTTRNRS>",
    "      <TRNUID>1</TRNUID>",
    "      <STATUS>",
    "        <CODE>0</CODE>",
    "        <SEVERITY>INFO</SEVERITY>",
    "      </STATUS>",
]
OFX_EPILOGUE = ["    </STMTTRNRS>", "  </BANKMSGSRSV1>", "</OFX>"]


@dataclass(frozen=True)
class ExportFile:
    """A generated export: body, media type and download filename."""

    content: str
    media_type: str
    filename: str


class ExportService:
    """Read-only exports of the authenticated user's transactions."""

    def __init__(self, session: AsyncSession, user: UserORM) -> None:
        """Binds the service to the request's session and authenticated user."""
        self.user = user
        self.repo = ExportRepository(session)

    async def export_csv(
        self, start_date: str, end_date: str | None, now: datetime | None = None
    ) -> ExportFile:
        """CSV with every transaction of the user in the period (dates as ``DD/MM/YYYY``).

        Raises:
            ValidationError: when a date is malformed.
        """
        now = now or datetime.now()
        transactions = await self._transactions(start_date, end_date, now)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(CSV_HEADER)
        for t in transactions:
            writer.writerow(
                [
                    t.transaction_date.strftime(BR_DATE_FORMAT) if t.transaction_date else "",
                    t.description,
                    f"{t.amount:.2f}",
                    t.type,
                    t.entity_type,
                    t.payment_method,
                    t.category.name if t.category else "",
                    t.subcategory.name if t.subcategory else "",
                    t.bank_code or "",
                    t.installment_number or "",
                    t.total_installments or "",
                ]
            )
        return ExportFile(
            output.getvalue(),
            CSV_MEDIA_TYPE,
            f"transacoes_{now.strftime(FILENAME_DATE_FORMAT)}.csv",
        )

    async def export_ofx(
        self, start_date: str, end_date: str | None, now: datetime | None = None
    ) -> ExportFile:
        """OFX 1.0 / QFX file with every transaction of the user in the period.

        Raises:
            ValidationError: when a date is malformed.
        """
        now = now or datetime.now()
        transactions = await self._transactions(start_date, end_date, now)

        lines = [
            *OFX_PROLOGUE,
            f"      <DTSERVER>{now.strftime(OFX_DATE_FORMAT)}</>",
            *OFX_BANK_HEADER,
        ]
        for t in transactions:
            trntype = "DEBIT" if t.type == EXPENSE_TYPE else "CREDIT"
            date_str = t.transaction_date.strftime(OFX_DATE_FORMAT) if t.transaction_date else ""
            category = t.category.name if t.category else ""
            subcategory = t.subcategory.name if t.subcategory else ""
            memo = f"{category}/{subcategory}: {t.description}"[:OFX_MEMO_MAX_LENGTH]
            lines += [
                "      <STMTTRN>",
                f"        <TRNTYPE>{trntype}</TRNTYPE>",
                f"        <DTPOSTED>{date_str}</DTPOSTED>",
                f"        <TRNAMT>{t.amount:.2f}</TRNAMT>",
                f"        <MEMO>{memo}</MEMO>",
                "      </STMTTRN>",
            ]
        lines += OFX_EPILOGUE
        return ExportFile(
            "\n".join(lines), OFX_MEDIA_TYPE, f"transacoes_{now.strftime(FILENAME_DATE_FORMAT)}.ofx"
        )

    async def _transactions(
        self, start_date: str, end_date: str | None, now: datetime
    ) -> list[TransactionORM]:
        """The user's transactions in the period; an open end defaults to today."""
        end = end_date or now.strftime(BR_DATE_FORMAT)
        return await self.repo.get_transactions_for_export(start_date, end, self.user.id)
