from fastapi import APIRouter, Depends, HTTPException, status, Request, UploadFile, File
from typing import List

from app.db.repositories.transacao import TransacaoRepository
from app.schemas.extracto import (
    UploadResponse,
    ParsedTransaction,
    ConfirmPayload,
    ConfirmResponse,
)
from app.services.extracto_parsers import parse_csv, parse_ofx
from app.logger import log_api_request
from uuid import uuid4
from datetime import datetime

router = APIRouter(prefix="/extractos", tags=["Extrato Bancario"])


@router.post("/upload", response_model=UploadResponse)
async def upload_extracto(
    request: Request,
    file: UploadFile = File(...),
):
    log = log_api_request(method="POST", endpoint=str(request.url), filename=file.filename)

    content = await file.read()
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

    entradas = [t for t in transactions if t['tipo'] == 'entrada']
    saidas = [t for t in transactions if t['tipo'] == 'saida']

    total_entradas = sum(t['valor'] for t in entradas)
    total_saidas = sum(t['valor'] for t in saidas)

    parsed = [ParsedTransaction(**t) for t in transactions]

    log.info(f"Extrato parseado: {len(transactions)} transacoes")

    return UploadResponse(
        total=len(transactions),
        entradas=len(entradas),
        saidas=len(saidas),
        total_entradas=total_entradas,
        total_saidas=total_saidas,
        transacoes=parsed,
    )


@router.post("/confirm", response_model=ConfirmResponse)
async def confirm_extracto(
    request: Request,
    payload: ConfirmPayload,
    repo: TransacaoRepository = Depends(),
):
    log = log_api_request(method="POST", endpoint=str(request.url), count=len(payload.transacoes))

    criadas = 0
    erros = []

    for trans in payload.transacoes:
        try:
            data_dt = datetime.strptime(trans.data, '%d/%m/%Y')

            await repo.create_from_extracto(
                valor=trans.valor,
                descricao=trans.descricao,
                data_transacao=data_dt,
                tipo=trans.tipo,
                natureza=trans.natureza,
                forma_pagamento=trans.forma_pagamento,
                categoria_id=trans.categoria_id,
                subcategoria_id=trans.subcategoria_id,
            )
            criadas += 1
        except Exception as e:
            erros.append(f"Erro ao criar '{trans.descricao}': {str(e)}")

    log.info(f"{criadas} transacoes criadas do extrato")

    return ConfirmResponse(criadas=criadas, erros=erros)
