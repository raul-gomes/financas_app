from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import SecretDecryptionError, decrypt_secret
from app.core.database import get_session
from app.core.security import get_current_user, require_admin
from app.db.models.user import UserORM
from app.db.repositories.settings import SettingsRepository
from app.db.repositories.transaction import TransacaoRepository
from app.logger import log_api_request, logger
from app.schemas.transaction import NaturezaTransacao, TipoTransacao
from app.services.limit_alert_service import trigger_limit_evaluation
from app.services.pluggy_service import PluggyService

# Description used when Pluggy sends none; the legacy (misspelled) text still matches rows
# imported before the fix.
FALLBACK_DESCRIPTION = "Sincronizado"
LEGACY_FALLBACK_DESCRIPTION = "Sin cronizar"


def pluggy_client_for(user: UserORM) -> PluggyService:
    """Build a Pluggy client from the user's stored (encrypted) API key.

    Raises:
        HTTPException: 500 if the stored key cannot be decrypted with the configured keys
            (server misconfiguration); the response never carries key material.
    """
    try:
        return PluggyService(decrypt_secret(user.pluggy_api_key))
    except SecretDecryptionError as exc:
        logger.error("Stored Pluggy API key could not be decrypted (check encryption keys)")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Não foi possível ler a API Key do Meu Pluggy salva. Contate o administrador.",
        ) from exc


router = APIRouter(
    prefix="/pluggy", tags=["Pluggy / Open Finance"], dependencies=[Depends(require_admin)]
)


@router.get(
    "/accounts",
    summary="Listar contas do Meu Pluggy",
    description="Retorna as contas conectadas ao Meu Pluggy do usuário.",
)
async def list_pluggy_accounts(
    request: Request,
    current_user: UserORM = Depends(get_current_user),
    settings_repo: SettingsRepository = Depends(),
):
    log = log_api_request(method="GET", endpoint=str(request.url))
    user = current_user
    if not user.pluggy_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API Key do Meu Pluggy não configurada. Vá em Configurações para adicionar.",
        )

    pluggy = pluggy_client_for(user)
    try:
        accounts = await pluggy.fetch_accounts()
        items = await pluggy.fetch_items()
        log.info(f"{len(accounts)} contas encontradas")
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


@router.post(
    "/sync",
    summary="Sincronizar transações do Meu Pluggy",
    description="Busca todas as transações das contas conectadas e importa para o app.",
)
async def sync_pluggy(
    request: Request,
    current_user: UserORM = Depends(get_current_user),
    settings_repo: SettingsRepository = Depends(),
    transacao_repo: TransacaoRepository = Depends(),
    db: AsyncSession = Depends(get_session),
):
    log = log_api_request(method="POST", endpoint=str(request.url))
    user = current_user
    if not user.pluggy_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="API Key do Meu Pluggy não configurada."
        )

    pluggy = pluggy_client_for(user)
    try:
        # Fetch accounts
        accounts = await pluggy.fetch_accounts()
        if not accounts:
            return {"message": "Nenhuma conta encontrada no Meu Pluggy.", "imported": 0}

        # Build all transaction data first
        all_transactions_data = []
        for account in accounts:
            account_id = account.get("id")
            if not account_id:
                continue

            transactions = await pluggy.fetch_transactions(account_id)
            log.info(f"Conta {account.get('name', '?')}: {len(transactions)} transações")

            for tx in transactions:
                tx_date_str = tx.get("date", tx.get("transactionDate"))
                tx_date = (
                    datetime.fromisoformat(tx_date_str.replace("Z", "+00:00"))
                    if tx_date_str
                    else datetime.now(UTC)
                )

                amount = abs(tx.get("amount", 0))
                tipo = TipoTransacao.SAIDA if tx.get("type") == "DEBIT" else TipoTransacao.ENTRADA

                form = tx.get("paymentMethod", tx.get("category", "pix")).lower()

                bank_code = None
                if account.get("type") == "BANK":
                    bank_code = str(account.get("number", ""))[:3]

                all_transactions_data.append(
                    {
                        "date": tx_date.strftime("%d/%m/%Y"),
                        "description": tx.get(
                            "description", tx.get("descriptionRaw", FALLBACK_DESCRIPTION)
                        )[:255],
                        "amount": amount,
                        "type": tipo.value,
                        "entity_type": NaturezaTransacao.PF.value,
                        "payment_method": form,
                        "category_name": "Importado",
                        "subcategory_name": "Pluggy",
                        "bank_code": bank_code,
                        "total_installments": None,
                        "is_installment": False,
                    }
                )

        # Batch create all transactions
        criadas, _erros = await transacao_repo.create_batch_from_extract(
            all_transactions_data, current_user.id
        )

        # Bulk duplicate check for newly created transactions
        duplicates_list = []
        if criadas > 0:
            # Get the newly created transactions (we need their IDs and dates/amounts)
            # We'll fetch them by checking duplicates in bulk
            from sqlalchemy import select

            from app.db.models.transaction import TransactionORM

            # Get recently created transactions by description pattern
            stmt = (
                select(TransactionORM)
                .where(
                    TransactionORM.description.like(f"%{FALLBACK_DESCRIPTION}%")
                    | TransactionORM.description.like(f"%{LEGACY_FALLBACK_DESCRIPTION}%")
                    | TransactionORM.description.like("%Pluggy%")
                )
                .where(TransactionORM.user_id == current_user.id)
                .order_by(TransactionORM.created_at.desc())
                .limit(criadas)
            )
            result = await transacao_repo.db.execute(stmt)
            new_transactions = list(result.unique().scalars().all())

            if new_transactions:
                # Bulk duplicate check: group by date+amount
                dup_check = {}
                for t in new_transactions:
                    key = (t.transaction_date.date(), t.amount)
                    dup_check.setdefault(key, []).append(t)

                # Check duplicates for each unique date+amount
                for key, txs in dup_check.items():
                    existing = await transacao_repo.check_duplicates(
                        key[0], key[1], current_user.id
                    )
                    real_dups = [d for d in existing if d.id not in [t.id for t in txs]]
                    if real_dups:
                        for t in txs:
                            duplicates_list.append(
                                {
                                    "new_id": t.id,
                                    "existing_id": real_dups[0].id,
                                    "description": t.description,
                                    "amount": t.amount,
                                    "transaction_date": t.transaction_date.isoformat(),
                                    "existing_description": real_dups[0].description,
                                    "existing_date": real_dups[0].transaction_date.isoformat(),
                                }
                            )
                            break

        result = {
            "message": f"{criadas} transações importadas de {len(accounts)} contas.",
            "imported": criadas,
            "accounts": len(accounts),
            "duplicates": duplicates_list,
        }
        try:
            now = datetime.now(UTC)
            await trigger_limit_evaluation(db, current_user.id, year=now.year, month=now.month)
        except SQLAlchemyError as e:
            log.warning(f"Falha ao avaliar limites pós-sync do pluggy: {e}")
        return result
    finally:
        await pluggy.close()


@router.get(
    "/validate-key",
    summary="Validar API Key do Meu Pluggy",
    description="Verifica se a chave de API do Meu Pluggy é válida.",
)
async def validate_pluggy_key(
    request: Request,
    current_user: UserORM = Depends(get_current_user),
    settings_repo: SettingsRepository = Depends(),
):
    log_api_request(method="GET", endpoint=str(request.url))
    user = current_user
    if not user.pluggy_api_key:
        return {"valid": False, "message": "API Key não configurada."}

    pluggy = pluggy_client_for(user)
    try:
        valid = await pluggy.validate_api_key()
        return {
            "valid": valid,
            "message": "API Key válida!" if valid else "API Key inválida. Verifique no Meu Pluggy.",
        }
    finally:
        await pluggy.close()
