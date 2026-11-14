"""Export routes (admin only): HTTP concerns only. The files are built by ExportService."""

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from app.core.security import require_admin
from app.logger import log_api_request
from app.routes.dependencies import get_export_service
from app.services.export_service import ExportFile, ExportService

router = APIRouter(prefix="/export", tags=["Exportação"], dependencies=[Depends(require_admin)])


def _download(file: ExportFile) -> StreamingResponse:
    """Wraps a generated export as an attachment download."""
    return StreamingResponse(
        iter([file.content]),
        media_type=file.media_type,
        headers={"Content-Disposition": f"attachment; filename={file.filename}"},
    )


@router.get(
    "/csv",
    summary="Exportar transações em CSV",
    description="Baixa um arquivo CSV com todas as transações no período.",
)
async def export_csv(
    request: Request,
    start_date: str = Query("01/01/2000", description="Data inicial DD/MM/YYYY"),
    end_date: str = Query(None, description="Data final DD/MM/YYYY"),
    service: ExportService = Depends(get_export_service),
):
    log = log_api_request(method="GET", endpoint=str(request.url))
    file = await service.export_csv(start_date, end_date)
    log.info("Exportando transações para CSV")
    return _download(file)


@router.get(
    "/ofx",
    summary="Exportar transações em OFX/QIF",
    description="Baixa um arquivo OFX (Open Financial Exchange) com as transações no período.",
)
async def export_ofx(
    request: Request,
    start_date: str = Query("01/01/2000", description="Data inicial DD/MM/YYYY"),
    end_date: str = Query(None, description="Data final DD/MM/YYYY"),
    service: ExportService = Depends(get_export_service),
):
    log = log_api_request(method="GET", endpoint=str(request.url))
    file = await service.export_ofx(start_date, end_date)
    log.info("Exportando transações para OFX")
    return _download(file)
