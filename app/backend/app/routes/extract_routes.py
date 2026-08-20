from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from typing import List

from app.db.repositories.transaction import TransacaoRepository
from app.schemas.extract import (
    UploadResponse,
    ParsedTransaction,
    ConfirmPayload,
    ConfirmResponse,
)
from app.services.extract_parsers import parse_csv, parse_ofx
from app.logger import log_api_request
from uuid import uuid4
from datetime import datetime

router = APIRouter(prefix="/extracts", tags=["Bank Extract"])


MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/upload", response_model=UploadResponse)
async def upload_extracto(
    request: Request,
    file: UploadFile = File(...),
):
    log = log_api_request(method="POST", endpoint=str(request.url), filename=file.filename)

    content = await file.read()
    if len(content) > MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"Arquivo muito grande. Tamanho máximo: {MAX_UPLOAD_SIZE // (1024 * 1024)} MB",
        )
    text = content.decode('utf-8', errors='replace')

    filename_lower = (file.filename or '').lower()

    if filename_lower.endswith('.ofx') or filename_lower.endswith('.qfx'):
        transactions = parse_ofx(text)
    elif filename_lower.endswith('.csv'):
        transactions = parse_csv(text)
    else:
        if '<OFX' in text.upper() or '<STMTTRN' in text.upper():
            transactions = parse_ofx(text)
        else:
            transactions = parse_csv(text)

    income_transactions = [t for t in transactions if t['type'] == 'income']
    expense_transactions = [t for t in transactions if t['type'] == 'expense']

    total_income_amount = sum(t['amount'] for t in income_transactions)
    total_expenses_amount = sum(t['amount'] for t in expense_transactions)

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
    repo: TransacaoRepository = Depends(),
):
    log = log_api_request(method="POST", endpoint=str(request.url), count=len(payload.transactions))

    criadas = 0
    erros = []

    for trans in payload.transactions:
        try:
            data_dt = datetime.strptime(trans.date, '%d/%m/%Y')

            await repo.create_from_extract(
                amount=trans.amount,
                description=trans.description,
                transaction_date=data_dt,
                type=trans.type,
                entity_type=trans.entity_type,
                payment_method=trans.payment_method,
                category_id=trans.category_id,
                subcategory_id=trans.subcategory_id,
                category_name=trans.category_name,
                subcategory_name=trans.subcategory_name,
                bank_code=trans.bank_code,
                total_installments=trans.total_installments,
                is_installment=trans.is_installment or False,
            )
            criadas += 1
        except Exception as e:
            erros.append(f"Erro ao criar '{trans.description}': {str(e)}")

    log.info(f"{criadas} transacoes criadas do extrato")

    return ConfirmResponse(created=criadas, errors=erros)
