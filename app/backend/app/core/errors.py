"""Domain exceptions and their single mapping to HTTP.

Services and repositories raise these; they never import FastAPI or build HTTP errors.
:func:`register_exception_handlers` (called once by ``create_app``) is the ONE place that
turns a :class:`DomainError` into a response, so status codes and the JSON shape stay uniform.

Messages are fixed, safe pt-BR texts written in code. Never put exception text, SQL, ids of
other users or any internal detail in a message: the client receives it verbatim.
"""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.logger import logger

UNHANDLED_ERROR_DETAIL = "Erro interno do servidor"


class DomainError(Exception):
    """Base of every error a use case can raise on purpose.

    Subclasses fix the HTTP status and a generic default message; a caller may pass a more
    specific (still safe, pt-BR) message.
    """

    status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_message: str = UNHANDLED_ERROR_DETAIL

    def __init__(self, message: str | None = None) -> None:
        """Stores the client-safe message (the class default when omitted)."""
        self.message = message or self.default_message
        super().__init__(self.message)


class ValidationError(DomainError):
    """The request is well-formed HTTP but breaks a business/validation rule (400)."""

    status_code = status.HTTP_400_BAD_REQUEST
    default_message = "Requisição inválida"


class UnprocessableError(ValidationError):
    """A required combination of fields is missing (422)."""

    status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
    default_message = "Dados incompletos"


class NotFoundError(DomainError):
    """The resource does not exist for the authenticated user (404)."""

    status_code = status.HTTP_404_NOT_FOUND
    default_message = "Recurso não encontrado"


class ConflictError(DomainError):
    """The change collides with existing data, e.g. a unique name (409)."""

    status_code = status.HTTP_409_CONFLICT
    default_message = "Conflito com dados existentes"


class ForbiddenError(DomainError):
    """The authenticated user may not do this (403)."""

    status_code = status.HTTP_403_FORBIDDEN
    default_message = "Acesso negado"


class PayloadTooLargeError(DomainError):
    """The uploaded content exceeds the allowed size (413)."""

    status_code = status.HTTP_413_CONTENT_TOO_LARGE
    default_message = "Conteúdo muito grande"


class UpstreamError(DomainError):
    """An external provider (e.g. Pluggy) failed or is unreachable (502)."""

    status_code = status.HTTP_502_BAD_GATEWAY
    default_message = "Serviço externo indisponível"


class ServerConfigError(DomainError):
    """A server-side misconfiguration the client can do nothing about (500)."""

    status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
    default_message = UNHANDLED_ERROR_DETAIL


def register_exception_handlers(application: FastAPI) -> None:
    """Maps :class:`DomainError` and any unexpected exception to JSON responses.

    Unexpected exceptions are logged server-side and answered with a generic 500: the client
    never sees the exception text.
    """

    @application.exception_handler(DomainError)
    async def domain_error_handler(request: Request, exc: DomainError) -> JSONResponse:
        """Answers a deliberate domain error with its status and safe message."""
        return JSONResponse(status_code=exc.status_code, content={"detail": exc.message})

    @application.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Logs the real error server-side; the client only gets a generic message."""
        logger.opt(exception=exc).error(
            f"Unhandled {type(exc).__name__} on {request.method} {request.url.path}"
        )
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={"detail": UNHANDLED_ERROR_DETAIL},
        )
