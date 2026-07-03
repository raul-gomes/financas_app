from fastapi import APIRouter, Depends, Request, Query, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
import csv
import io

from app.core.database import get_session
from app.db.models.transaction import TransactionORM
from app.db.models.category import CategoryORM, SubcategoryORM
from app.logger import log_api_request

router = APIRouter(prefix="/export", tags=["Exportação"])


async def _fetch_transactions_for_export(
    db: AsyncSession,
    start_date: str,
    end_date: str,
):
    """Fetch transactions with joined category/subcategory within date range."""
    try:
        dt_i = datetime.strptime(start_date, "%d/%m/%Y") if start_date else datetime(2000, 1, 1)
        dt_f = datetime.strptime(end_date, "%d/%m/%Y") if end_date else datetime.now()
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Formato de data inválido. Use DD/MM/YYYY.",
        )

    result = await db.execute(
        select(TransactionORM)
        .where(TransactionORM.transaction_date >= dt_i)
        .where(TransactionORM.transaction_date <= dt_f)
        .order_by(TransactionORM.transaction_date.desc())
    )
    return result.unique().scalars().all()


@router.get(
    "/csv",
    summary="Exportar transações em CSV",
    description="Baixa um arquivo CSV com todas as transações no período."
)
async def export_csv(
    request: Request,
    start_date: str = Query("01/01/2000", description="Data inicial DD/MM/YYYY"),
    end_date: str = Query(None, description="Data final DD/MM/YYYY"),
    db: AsyncSession = Depends(get_session),
):
    log = log_api_request(method="GET", endpoint=str(request.url))
    if not end_date:
        end_date = datetime.now().strftime("%d/%m/%Y")

    transactions = await _fetch_transactions_for_export(db, start_date, end_date)
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
            t.transaction_date.strftime("%d/%m/%Y") if t.transaction_date else "",
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
    start_date: str = Query("01/01/2000", description="Data inicial DD/MM/YYYY"),
    end_date: str = Query(None, description="Data final DD/MM/YYYY"),
    db: AsyncSession = Depends(get_session),
):
    log = log_api_request(method="GET", endpoint=str(request.url))
    if not end_date:
        end_date = datetime.now().strftime("%d/%m/%Y")

    transactions = await _fetch_transactions_for_export(db, start_date, end_date)
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
        trntype = "DEBIT" if t.type == "expense" else "CREDIT"
        date_str = t.transaction_date.strftime("%Y%m%d") if t.transaction_date else ""
        cat = t.category.name if t.category else ""
        subcat = t.subcategory.name if t.subcategory else ""
        memo = f"{cat}/{subcat}: {t.description}"[:255]

        lines.append("      <STMTTRN>")
        lines.append(f"        <TRNTYPE>{trntype}</TRNTYPE>")
        lines.append(f"        <DTPOSTED>{date_str}</DTPOSTED>")
        lines.append(f"        <TRNAMT>{t.amount:.2f}</TRNAMT>")
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
