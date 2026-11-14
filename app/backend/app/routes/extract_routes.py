from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_session
from app.core.security import get_current_user, require_admin
from app.db.models.user import UserORM
from app.db.repositories.transaction import TransacaoRepository
from app.logger import log_api_request
from app.schemas.extract import (
    ConfirmPayload,
    ConfirmResponse,
    ParsedTransaction,
    UploadResponse,
)
from app.services.extract_parsers import parse_csv, parse_ofx
from app.services.limit_alert_service import trigger_limit_evaluation

router = APIRouter(prefix="/extracts", tags=["Bank Extract"], dependencies=[Depends(require_admin)])


MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/upload", response_model=UploadResponse)
async def upload_extracto(
    request: Request,
    current_user: UserORM = Depends(get_current_user),
    file: UploadFile = File(...),
):
    log = log_api_request(method="POST", endpoint=str(request.url), filename=file.filename)

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Arquivo muito grande. Tamanho máximo: {MAX_UPLOAD_SIZE // (1024 * 1024)} MB",
        )
    text = content.decode("utf-8", errors="replace")

    filename_lower = (file.filename or "").lower()

    if filename_lower.endswith(".ofx") or filename_lower.endswith(".qfx"):
        transactions = parse_ofx(text)
    elif filename_lower.endswith(".csv"):
        transactions = parse_csv(text)
    else:
        if "<OFX" in text.upper() or "<STMTTRN" in text.upper():
            transactions = parse_ofx(text)
        else:
            transactions = parse_csv(text)

    income_transactions = [t for t in transactions if t["type"] == "income"]
    expense_transactions = [t for t in transactions if t["type"] == "expense"]

    total_income_amount = sum(t["amount"] for t in income_transactions)
    total_expenses_amount = sum(t["amount"] for t in expense_transactions)

    parsed = [ParsedTransaction(**t) for t in transactions]

    log.info(f"Extrato parseado: {len(transactions)} transacoes")

    return UploadResponse(
        total=len(transactions),
        total_income=len(income_transactions),
        total_expenses=len(expense_transactions),
        total_income_amount=total_income_amount,
        total_expenses_amount=total_expenses_amount,
        transactions=parsed,
    )


@router.post("/confirm", response_model=ConfirmResponse)
async def confirm_extracto(
    request: Request,
    payload: ConfirmPayload,
    current_user: UserORM = Depends(get_current_user),
    repo: TransacaoRepository = Depends(),
    db: AsyncSession = Depends(get_session),
):
    log = log_api_request(method="POST", endpoint=str(request.url), count=len(payload.transactions))

    # Convert ParsedTransaction to dict for batch processing
    transactions_data = []
    for trans in payload.transactions:
        transactions_data.append(
            {
                "date": trans.date,
                "description": trans.description,
                "amount": trans.amount,
                "type": trans.type,
                "entity_type": trans.entity_type,
                "payment_method": trans.payment_method,
                "category_id": trans.category_id,
                "subcategory_id": trans.subcategory_id,
                "category_name": trans.category_name,
                "subcategory_name": trans.subcategory_name,
                "bank_code": trans.bank_code,
                "total_installments": trans.total_installments,
                "is_installment": trans.is_installment or False,
            }
        )

    criadas, erros = await repo.create_batch_from_extract(transactions_data, current_user.id)

    try:
        if payload.transactions:
            primeira = min(t.date for t in payload.transactions)
            await trigger_limit_evaluation(
                db, current_user.id, year=primeira.year, month=primeira.month
            )
    except Exception as e:
        log.warning(f"Falha ao avaliar limites pós-extrato: {e}")

    log.info(f"{criadas} transacoes criadas do extrato")

    return ConfirmResponse(created=criadas, errors=erros)
