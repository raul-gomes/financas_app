"""Bank-extract service: parsing an uploaded statement and importing the confirmed rows.

Layering (see AGENTS.md): route -> service -> repository. The routes are admin-only (guard on
the router) and read the upload (size limit is an HTTP concern); parsing and the batch import
live here. The batch import only flushes: the unit of work commits once when the route returns
and the limit-alert evaluation runs after that commit.
"""

from datetime import datetime

from app.core.unit_of_work import UnitOfWork
from app.db.models.user import UserORM
from app.db.repositories.transaction import TransacaoRepository
from app.logger import logger
from app.schemas.extract import (
    ConfirmPayload,
    ConfirmResponse,
    ParsedTransaction,
    UploadResponse,
)
from app.services.extract_parsers import parse_csv, parse_ofx
from app.services.limit_alert_service import trigger_limit_evaluation

STATEMENT_DATE_FORMAT = "%d/%m/%Y"  # ParsedTransaction.date wire format
OFX_EXTENSIONS = (".ofx", ".qfx")
CSV_EXTENSION = ".csv"
OFX_MARKERS = ("<OFX", "<STMTTRN")


class ExtractService:
    """Use cases over statement uploads for the authenticated user."""

    def __init__(self, uow: UnitOfWork, user: UserORM) -> None:
        """Binds the service to the request's unit of work and authenticated user."""
        self.uow = uow
        self.user = user
        self.transactions = TransacaoRepository(uow.session)

    @staticmethod
    def parse_upload(filename: str | None, content: bytes) -> UploadResponse:
        """Parses an OFX/QFX/CSV statement (format by extension, else sniffed from content).

        Raises:
            UnsafeOfxError: (a ValidationError) when an OFX uses forbidden XML constructs.
        """
        text = content.decode("utf-8", errors="replace")
        name = (filename or "").lower()

        if name.endswith(OFX_EXTENSIONS):
            transactions = parse_ofx(text)
        elif name.endswith(CSV_EXTENSION):
            transactions = parse_csv(text)
        elif any(marker in text.upper() for marker in OFX_MARKERS):
            transactions = parse_ofx(text)
        else:
            transactions = parse_csv(text)

        income = [t for t in transactions if t["type"] == "income"]
        expenses = [t for t in transactions if t["type"] == "expense"]
        return UploadResponse(
            total=len(transactions),
            total_income=len(income),
            total_expenses=len(expenses),
            total_income_amount=sum(t["amount"] for t in income),
            total_expenses_amount=sum(t["amount"] for t in expenses),
            transactions=[ParsedTransaction(**t) for t in transactions],
        )

    async def confirm(self, payload: ConfirmPayload) -> ConfirmResponse:
        """Imports the confirmed rows for the authenticated user in one batch.

        Rows that cannot be built are reported in ``errors``. Limits are re-evaluated for the
        earliest statement month once the batch is committed.
        """
        rows = [
            {
                "date": row.date,
                "description": row.description,
                "amount": row.amount,
                "type": row.type,
                "entity_type": row.entity_type,
                "payment_method": row.payment_method,
                "category_id": row.category_id,
                "subcategory_id": row.subcategory_id,
                "category_name": row.category_name,
                "subcategory_name": row.subcategory_name,
                "bank_code": row.bank_code,
                "total_installments": row.total_installments,
                "is_installment": row.is_installment or False,
            }
            for row in payload.transactions
        ]
        created, errors = await self.transactions.create_batch_from_extract(rows, self.user.id)

        earliest = self._earliest_date([row["date"] for row in rows])
        if earliest is not None:
            self._evaluate_limits_after_commit(earliest)
        return ConfirmResponse(created=created, errors=errors)

    @staticmethod
    def _earliest_date(dates: list[str]) -> datetime | None:
        """Earliest parseable ``DD/MM/YYYY`` date; unparseable rows are already reported by
        the batch as errors, so they only get a log line here."""
        parsed: list[datetime] = []
        for value in dates:
            try:
                parsed.append(datetime.strptime(value, STATEMENT_DATE_FORMAT))
            except ValueError:
                logger.warning("Extract row with unparseable date ignored for limit evaluation")
        return min(parsed) if parsed else None

    def _evaluate_limits_after_commit(self, month_of: datetime) -> None:
        """Schedules the limit-alert evaluation for ``month_of``'s month, after the commit."""
        user_id = self.user.id
        session = self.uow.session

        async def evaluate() -> None:
            await trigger_limit_evaluation(
                session, user_id, year=month_of.year, month=month_of.month
            )

        self.uow.after_commit(evaluate)
