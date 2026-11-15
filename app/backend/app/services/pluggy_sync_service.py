"""Pluggy sync service: Open Finance use cases of the authenticated user.

Layering (see AGENTS.md): route -> service -> repository. The routes are admin-only (guard on
the router). The user's Pluggy key is read (decrypted) from the authenticated user, never from
the client. The import only flushes: the unit of work commits once when the route returns and
the limit-alert evaluation runs after that commit.
"""

from datetime import UTC, datetime
from typing import Any

from app.core.crypto import SecretDecryptionError, decrypt_secret
from app.core.errors import ServerConfigError, ValidationError
from app.core.unit_of_work import UnitOfWork
from app.db.models.transaction import TransactionORM
from app.db.models.user import UserORM
from app.db.repositories.transaction import TransacaoRepository
from app.logger import logger
from app.schemas.transaction import NaturezaTransacao, TipoTransacao
from app.services.limit_alert_service import trigger_limit_evaluation
from app.services.pluggy_service import PluggyService

# Description used when Pluggy sends none; the legacy (misspelled) text still matches rows
# imported before the fix.
FALLBACK_DESCRIPTION = "Sincronizado"
LEGACY_FALLBACK_DESCRIPTION = "Sin cronizar"
IMPORT_CATEGORY_NAME = "Importado"
IMPORT_SUBCATEGORY_NAME = "Pluggy"
DEFAULT_PAYMENT_METHOD = "pix"
DESCRIPTION_MAX_LENGTH = 255
BANK_CODE_LENGTH = 3
STATEMENT_DATE_FORMAT = "%d/%m/%Y"
PLUGGY_DEBIT = "DEBIT"
BANK_ACCOUNT_TYPE = "BANK"
IMPORTED_DESCRIPTION_PATTERNS = [
    f"%{FALLBACK_DESCRIPTION}%",
    f"%{LEGACY_FALLBACK_DESCRIPTION}%",
    f"%{IMPORT_SUBCATEGORY_NAME}%",
]

KEY_NOT_CONFIGURED_WITH_HINT = (
    "API Key do Meu Pluggy não configurada. Vá em Configurações para adicionar."
)
KEY_NOT_CONFIGURED = "API Key do Meu Pluggy não configurada."
KEY_UNREADABLE = "Não foi possível ler a API Key do Meu Pluggy salva. Contate o administrador."


def pluggy_client_for(user: UserORM) -> PluggyService:
    """Build a Pluggy client from the user's stored (encrypted) API key.

    Raises:
        ServerConfigError: if the stored key cannot be decrypted with the configured keys
            (server misconfiguration); the response never carries key material.
    """
    try:
        return PluggyService(decrypt_secret(user.pluggy_api_key))
    except SecretDecryptionError as exc:
        logger.error("Stored Pluggy API key could not be decrypted (check encryption keys)")
        raise ServerConfigError(KEY_UNREADABLE) from exc


class PluggySyncService:
    """Use cases that talk to Meu Pluggy on behalf of the authenticated user."""

    def __init__(self, uow: UnitOfWork, user: UserORM) -> None:
        """Binds the service to the request's unit of work and authenticated user."""
        self.uow = uow
        self.user = user
        self.transactions = TransacaoRepository(uow.session)

    async def list_accounts(self) -> dict[str, Any]:
        """Accounts and connections of the user's Meu Pluggy.

        Raises:
            ValidationError: when the user has no Pluggy key configured.
        """
        if not self.user.pluggy_api_key:
            raise ValidationError(KEY_NOT_CONFIGURED_WITH_HINT)

        pluggy = pluggy_client_for(self.user)
        try:
            accounts = await pluggy.fetch_accounts()
            items = await pluggy.fetch_items()
            return {
                "accounts": accounts,
                "items": [
                    {
                        "id": item.id,
                        "status": item.status,
                        "institution_name": item.institution_name,
                        "institution_number": item.institution_number,
                    }
                    for item in items
                ],
            }
        finally:
            await pluggy.close()

    async def validate_key(self) -> dict[str, Any]:
        """Checks whether the user's stored Pluggy key is accepted by Meu Pluggy."""
        if not self.user.pluggy_api_key:
            return {"valid": False, "message": "API Key não configurada."}

        pluggy = pluggy_client_for(self.user)
        try:
            valid = await pluggy.validate_api_key()
            return {
                "valid": valid,
                "message": "API Key válida!"
                if valid
                else "API Key inválida. Verifique no Meu Pluggy.",
            }
        finally:
            await pluggy.close()

    async def sync(self) -> dict[str, Any]:
        """Imports every transaction of the user's Pluggy accounts and flags duplicates.

        Raises:
            ValidationError: when the user has no Pluggy key configured.
        """
        if not self.user.pluggy_api_key:
            raise ValidationError(KEY_NOT_CONFIGURED)

        pluggy = pluggy_client_for(self.user)
        try:
            accounts = await pluggy.fetch_accounts()
            if not accounts:
                return {"message": "Nenhuma conta encontrada no Meu Pluggy.", "imported": 0}

            rows: list[dict[str, Any]] = []
            for account in accounts:
                account_id = account.get("id")
                if not account_id:
                    continue
                transactions = await pluggy.fetch_transactions(account_id)
                logger.info(f"Conta {account.get('name', '?')}: {len(transactions)} transações")
                rows.extend(self._to_import_row(tx, account) for tx in transactions)
        finally:
            await pluggy.close()

        created, _errors = await self.transactions.create_batch_from_extract(rows, self.user.id)
        duplicates = await self._find_duplicates(created) if created > 0 else []
        self._evaluate_limits_after_commit()
        return {
            "message": f"{created} transações importadas de {len(accounts)} contas.",
            "imported": created,
            "accounts": len(accounts),
            "duplicates": duplicates,
        }

    @staticmethod
    def _to_import_row(tx: dict[str, Any], account: dict[str, Any]) -> dict[str, Any]:
        """Maps one Pluggy transaction to the batch-import row shape."""
        tx_date_str = tx.get("date", tx.get("transactionDate"))
        tx_date = (
            datetime.fromisoformat(tx_date_str.replace("Z", "+00:00"))
            if tx_date_str
            else datetime.now(UTC)
        )
        kind = TipoTransacao.SAIDA if tx.get("type") == PLUGGY_DEBIT else TipoTransacao.ENTRADA
        bank_code = None
        if account.get("type") == BANK_ACCOUNT_TYPE:
            bank_code = str(account.get("number", ""))[:BANK_CODE_LENGTH]
        return {
            "date": tx_date.strftime(STATEMENT_DATE_FORMAT),
            "description": tx.get("description", tx.get("descriptionRaw", FALLBACK_DESCRIPTION))[
                :DESCRIPTION_MAX_LENGTH
            ],
            "amount": abs(tx.get("amount", 0)),
            "type": kind.value,
            "entity_type": NaturezaTransacao.PF.value,
            "payment_method": tx.get(
                "paymentMethod", tx.get("category", DEFAULT_PAYMENT_METHOD)
            ).lower(),
            "category_name": IMPORT_CATEGORY_NAME,
            "subcategory_name": IMPORT_SUBCATEGORY_NAME,
            "bank_code": bank_code,
            "total_installments": None,
            "is_installment": False,
        }

    async def _find_duplicates(self, created: int) -> list[dict[str, Any]]:
        """Flags imported rows that share date and amount with a pre-existing transaction."""
        recent = await self.transactions.list_latest_by_description_patterns(
            self.user.id, IMPORTED_DESCRIPTION_PATTERNS, created
        )
        groups: dict[tuple, list[TransactionORM]] = {}
        for tx in recent:
            groups.setdefault((tx.transaction_date.date(), tx.amount), []).append(tx)

        duplicates: list[dict[str, Any]] = []
        for (day, amount), group in groups.items():
            imported_ids = {tx.id for tx in group}
            existing = await self.transactions.check_duplicates(day, amount, self.user.id)
            real = [row for row in existing if row.id not in imported_ids]
            if not real:
                continue
            tx = group[0]
            duplicates.append(
                {
                    "new_id": tx.id,
                    "existing_id": real[0].id,
                    "description": tx.description,
                    "amount": tx.amount,
                    "transaction_date": tx.transaction_date.isoformat(),
                    "existing_description": real[0].description,
                    "existing_date": real[0].transaction_date.isoformat(),
                }
            )
        return duplicates

    def _evaluate_limits_after_commit(self) -> None:
        """Schedules the limit-alert evaluation for the current month, after the commit."""
        now = datetime.now(UTC)
        user_id = self.user.id
        session = self.uow.session

        async def evaluate() -> None:
            await trigger_limit_evaluation(session, user_id, year=now.year, month=now.month)

        self.uow.after_commit(evaluate)
