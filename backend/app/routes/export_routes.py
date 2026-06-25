from fastapi import APIRouter, Depends, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import csv
import io

from app.core.database import get_session
from app.db.models.transacao import TransacaoORM
from app.db.models.categoria import CategoriaORM, SubcategoriaORM
from app.logger import log_api_request

router = APIRouter(prefix="/export", tags=["Exportação"])


async def _fetch_transactions_for_export(
    db: AsyncSession,
    data_inicio: str,
    data_final: str,
):
    """Fetch transactions with joined category/subcategory within date range."""
    dt_i = datetime.strptime(data_inicio, "%d/%m/%Y") if data_inicio else datetime(2000, 1, 1)
    dt_f = datetime.strptime(data_final, "%d/%m/%Y") if data_final else datetime.now()

    result = await db.execute(
        select(TransacaoORM)
        .where(TransacaoORM.data_transacao >= dt_i)
        .where(TransacaoORM.data_transacao <= dt_f)
        .order_by(TransacaoORM.data_transacao.desc())
    )
    return result.unique().scalars().all()


@router.get(
    "/csv",
    summary="Exportar transações em CSV",
    description="Baixa um arquivo CSV com todas as transações no período."
)
async def export_csv(
    request: Request,
    data_inicio: str = Query("01/01/2000", description="Data inicial DD/MM/YYYY"),
    data_final: str = Query(None, description="Data final DD/MM/YYYY"),
    db: AsyncSession = Depends(get_session),
):
    log = log_api_request(method="GET", endpoint=str(request.url))
    if not data_final:
        data_final = datetime.now().strftime("%d/%m/%Y")

    transactions = await _fetch_transactions_for_export(db, data_inicio, data_final)
    log.info(f"Exportando {len(transactions)} transações para CSV")

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "Data", "Descrição", "Valor", "Tipo", "Natureza",
        "Forma Pagamento", "Categoria", "Subcategoria", "Banco",
        "Parcela", "Total Parcelas"
    ])

    for t in transactions:
        writer.writerow([
            t.data_transacao.strftime("%d/%m/%Y") if t.data_transacao else "",
            t.descricao,
            f"{t.valor:.2f}",
            t.tipo,
            t.natureza,
            t.forma_pagamento,
            t.categoria.categoria_nome if t.categoria else "",
            t.subcategoria.subcategoria_nome if t.subcategoria else "",
            t.bank_code or "",
            t.parcela or "",
            t.total_parcelas or "",
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=transacoes_{datetime.now().strftime('%Y%m%d')}.csv"
        },
    )


@router.get(
    "/ofx",
    summary="Exportar transações em OFX/QIF",
    description="Baixa um arquivo OFX (Open Financial Exchange) com as transações no período."
)
async def export_ofx(
    request: Request,
    data_inicio: str = Query("01/01/2000", description="Data inicial DD/MM/YYYY"),
    data_final: str = Query(None, description="Data final DD/MM/YYYY"),
    db: AsyncSession = Depends(get_session),
):
    log = log_api_request(method="GET", endpoint=str(request.url))
    if not data_final:
        data_final = datetime.now().strftime("%d/%m/%Y")

    transactions = await _fetch_transactions_for_export(db, data_inicio, data_final)
    log.info(f"Exportando {len(transactions)} transações para OFX")

    # Generate OFX (OFX 1.0 / QFX format)
    lines = [
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
        "      <DTSERVER>{}</>".format(datetime.now().strftime("%Y%m%d")),
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

    # Add transactions
    for t in transactions:
        trntype = "DEBIT" if t.tipo == "saida" else "CREDIT"
        date_str = t.data_transacao.strftime("%Y%m%d") if t.data_transacao else ""
        cat = t.categoria.categoria_nome if t.categoria else ""
        subcat = t.subcategoria.subcategoria_nome if t.subcategoria else ""
        memo = f"{cat}/{subcat}: {t.descricao}"[:255]

        lines.append("      <STMTTRN>")
        lines.append(f"        <TRNTYPE>{trntype}</TRNTYPE>")
        lines.append(f"        <DTPOSTED>{date_str}</DTPOSTED>")
        lines.append(f"        <TRNAMT>{t.valor:.2f}</TRNAMT>")
        lines.append(f"        <MEMO>{memo}</MEMO>")
        lines.append("      </STMTTRN>")

    lines.append("    </STMTTRNRS>")
    lines.append("  </BANKMSGSRSV1>")
    lines.append("</OFX>")

    content = "\n".join(lines)
    return StreamingResponse(
        iter([content]),
        media_type="application/x-ofx",
        headers={
            "Content-Disposition": f"attachment; filename=transacoes_{datetime.now().strftime('%Y%m%d')}.ofx"
        },
    )
