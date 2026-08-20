from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Optional
from datetime import date, datetime

from app.db.repositories.settings import SettingsRepository
from app.db.repositories.transaction import TransacaoRepository
from app.services.pluggy_service import PluggyService
from app.schemas.transaction import DuplicateInfo, TransacaoCreate, TipoTransacao, NaturezaTransacao
from app.logger import log_api_request

router = APIRouter(prefix="/pluggy", tags=["Pluggy / Open Finance"])


@router.get(
    "/accounts",
    summary="Listar contas do Meu Pluggy",
    description="Retorna as contas conectadas ao Meu Pluggy do usuário."
)
async def list_pluggy_accounts(
    request: Request,
    settings_repo: SettingsRepository = Depends(),
):
    log = log_api_request(method="GET", endpoint=str(request.url))
    user = await settings_repo.get_or_create_default_user()
    if not user.pluggy_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API Key do Meu Pluggy não configurada. Vá em Configurações para adicionar."
        )

    pluggy = PluggyService(user.pluggy_api_key)
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
    description="Busca todas as transações das contas conectadas e importa para o app."
)
async def sync_pluggy(
    request: Request,
    settings_repo: SettingsRepository = Depends(),
    transacao_repo: TransacaoRepository = Depends(),
):
    log = log_api_request(method="POST", endpoint=str(request.url))
    user = await settings_repo.get_or_create_default_user()
    if not user.pluggy_api_key:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="API Key do Meu Pluggy não configurada."
        )

    pluggy = PluggyService(user.pluggy_api_key)
    try:
        # Fetch accounts
        accounts = await pluggy.fetch_accounts()
        if not accounts:
            return {"message": "Nenhuma conta encontrada no Meu Pluggy.", "imported": 0}

        total_imported = 0
        all_created_ids: List[int] = []
        for account in accounts:
            account_id = account.get("id")
            if not account_id:
                continue

            # Fetch transactions for this account
            transactions = await pluggy.fetch_transactions(account_id)
            log.info(f"Conta {account.get('name', '?')}: {len(transactions)} transações")

            for tx in transactions:
                # Map Pluggy transaction to our model
                tx_date_str = tx.get("date", tx.get("transactionDate"))
                tx_date = datetime.fromisoformat(tx_date_str.replace("Z", "+00:00")) if tx_date_str else datetime.now()

                amount = abs(tx.get("amount", 0))
                # Determine type: DEBIT = expense, CREDIT = income
                tipo = TipoTransacao.SAIDA if tx.get("type") == "DEBIT" else TipoTransacao.ENTRADA

                # Determine payment_method from transaction type info
                form = tx.get("paymentMethod", tx.get("category", "pix")).lower()

                # Map bank code from account
                bank_code = None
                if account.get("type") == "BANK":
                    bank_code = str(account.get("number", ""))[:3]

                created = await transacao_repo.create(
                    TransacaoCreate(
                        amount=amount,
                        description=tx.get("description", tx.get("descriptionRaw", "Sin cronizar"))[:255],
                        transaction_date=tx_date,
                        type=tipo,
                        entity_type=NaturezaTransacao.PF,
                        payment_method=form,
                        category_name="Importado",
                        subcategory_name="Pluggy",
                        bank_code=bank_code,
                    )
                )
                all_created_ids.append(created.id)
                total_imported += 1

        # After all imports, detect duplicates among newly created transactions
        duplicates_list = []
        for new_id in all_created_ids:
            new_t = await transacao_repo.get_by_id(new_id)
            if not new_t:
                continue
            existing = await transacao_repo.check_duplicates(
                new_t.transaction_date.date(), new_t.amount
            )
            # Filter out self and any others already in this sync batch
            real_dups = [t for t in existing if t.id != new_id and t.id not in all_created_ids]
            if real_dups:
                for dup in real_dups:
                    duplicates_list.append({
                        "new_id": new_id,
                        "existing_id": dup.id,
                        "description": new_t.description,
                        "amount": new_t.amount,
                        "transaction_date": new_t.transaction_date.isoformat(),
                        "existing_description": dup.description,
                        "existing_date": dup.transaction_date.isoformat(),
                    })
                    break  # Only report one per new transaction

        result = {
            "message": f"{total_imported} transações importadas de {len(accounts)} contas.",
            "imported": total_imported,
            "accounts": len(accounts),
            "duplicates": duplicates_list,
        }
        return result
    finally:
        await pluggy.close()


@router.get(
    "/validate-key",
    summary="Validar API Key do Meu Pluggy",
    description="Verifica se a chave de API do Meu Pluggy é válida."
)
async def validate_pluggy_key(
    request: Request,
    settings_repo: SettingsRepository = Depends(),
):
    log = log_api_request(method="GET", endpoint=str(request.url))
    user = await settings_repo.get_or_create_default_user()
    if not user.pluggy_api_key:
        return {"valid": False, "message": "API Key não configurada."}

    pluggy = PluggyService(user.pluggy_api_key)
    try:
        valid = await pluggy.validate_api_key()
        return {
            "valid": valid,
            "message": "API Key válida!" if valid else "API Key inválida. Verifique no Meu Pluggy.",
        }
    finally:
        await pluggy.close()
