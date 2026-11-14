"""Domain exceptions: one mapping to HTTP, generic pt-BR messages, no internal text leaked."""

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient

from app.core.errors import (
    UNHANDLED_ERROR_DETAIL,
    ConflictError,
    DomainError,
    ForbiddenError,
    NotFoundError,
    PayloadTooLargeError,
    ServerConfigError,
    UnprocessableError,
    UpstreamError,
    ValidationError,
    register_exception_handlers,
)

LEAK_MARKER = "leak-marker-internal-detail"

EXPECTED_STATUS = [
    (ValidationError, 400),
    (UnprocessableError, 422),
    (NotFoundError, 404),
    (ConflictError, 409),
    (ForbiddenError, 403),
    (PayloadTooLargeError, 413),
    (UpstreamError, 502),
    (ServerConfigError, 500),
]


def _app_raising(exc: Exception) -> FastAPI:
    """Minimal app whose only route raises ``exc``, wired like the real one."""
    application = FastAPI()
    register_exception_handlers(application)

    @application.get("/boom")
    async def boom() -> None:
        raise exc

    return application


async def _get(application: FastAPI) -> tuple[int, dict]:
    transport = ASGITransport(app=application, raise_app_exceptions=False)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/boom")
    return response.status_code, response.json()


@pytest.mark.parametrize(("error_class", "status_code"), EXPECTED_STATUS)
async def test_each_error_maps_to_its_status_with_a_default_message(error_class, status_code):
    status, body = await _get(_app_raising(error_class()))

    assert status == status_code
    assert body == {"detail": error_class.default_message}


@pytest.mark.parametrize(("error_class", "_status"), EXPECTED_STATUS)
async def test_default_messages_are_non_empty_text(error_class, _status):
    assert error_class.default_message.strip()
    assert error_class.default_message != error_class.__name__


async def test_specific_message_is_sent_as_given():
    status, body = await _get(_app_raising(NotFoundError("Categoria não encontrada")))

    assert (status, body) == (404, {"detail": "Categoria não encontrada"})


def test_every_error_is_a_domain_error():
    assert all(issubclass(error_class, DomainError) for error_class, _ in EXPECTED_STATUS)
    assert issubclass(UnprocessableError, ValidationError)


async def test_cause_text_never_reaches_the_client():
    """The chained cause (e.g. a database error) is for the logs, not for the response."""
    try:
        try:
            raise RuntimeError(LEAK_MARKER)
        except RuntimeError as exc:
            raise ConflictError("Nome já existe") from exc
    except ConflictError as domain_error:
        application = _app_raising(domain_error)

    status, body = await _get(application)

    assert status == 409
    assert LEAK_MARKER not in str(body)


async def test_unexpected_error_gets_the_generic_500():
    status, body = await _get(_app_raising(RuntimeError(LEAK_MARKER)))

    assert status == 500
    assert body == {"detail": UNHANDLED_ERROR_DETAIL}
    assert LEAK_MARKER not in str(body)


async def test_real_app_maps_service_not_found_to_404(client):
    response = await client.get("/transacoes/987654")

    assert response.status_code == 404
    assert response.json() == {"detail": "Transação não encontrada"}


async def test_real_app_maps_invalid_date_to_400(client):
    response = await client.get("/transacoes/paginated", params={"start_date": "2026-01-01"})

    assert response.status_code == 400
    assert response.json() == {"detail": "Formato inválido para start_date. Use DD/MM/YYYY."}
