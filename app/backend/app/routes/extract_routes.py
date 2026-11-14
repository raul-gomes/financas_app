"""Bank-extract routes (admin only): HTTP concerns only. Parsing/import live in ExtractService."""

from fastapi import APIRouter, Depends, File, Request, UploadFile

from app.core.errors import PayloadTooLargeError
from app.core.security import require_admin
from app.logger import log_api_request
from app.routes.dependencies import get_extract_reader, get_extract_service
from app.schemas.extract import ConfirmPayload, ConfirmResponse, UploadResponse
from app.services.extract_service import ExtractService

router = APIRouter(prefix="/extracts", tags=["Bank Extract"], dependencies=[Depends(require_admin)])


MAX_UPLOAD_SIZE = 10 * 1024 * 1024  # 10 MB
UPLOAD_READ_CHUNK_SIZE = 64 * 1024  # 64 KB


async def _read_limited(file: UploadFile, max_size: int = MAX_UPLOAD_SIZE) -> bytes:
    """Read the upload in chunks, raising PayloadTooLargeError as soon as ``max_size`` is exceeded."""
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(UPLOAD_READ_CHUNK_SIZE):
        total += len(chunk)
        if total > max_size:
            raise PayloadTooLargeError(
                f"Arquivo muito grande. Tamanho máximo: {max_size // (1024 * 1024)} MB"
            )
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("/upload", response_model=UploadResponse)
async def upload_extracto(
    request: Request,
    file: UploadFile = File(...),
    service: ExtractService = Depends(get_extract_reader),
):
    log = log_api_request(method="POST", endpoint=str(request.url), filename=file.filename)
    content = await _read_limited(file)
    response = service.parse_upload(file.filename, content)
    log.info(f"Extrato parseado: {response.total} transacoes")
    return response


@router.post("/confirm", response_model=ConfirmResponse)
async def confirm_extracto(
    request: Request,
    payload: ConfirmPayload,
    service: ExtractService = Depends(get_extract_service),
):
    log = log_api_request(method="POST", endpoint=str(request.url), count=len(payload.transactions))
    response = await service.confirm(payload)
    log.info(f"{response.created} transacoes criadas do extrato")
    return response
