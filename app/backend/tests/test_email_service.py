import pytest
import pytest_asyncio
from unittest.mock import AsyncMock, patch

from app.services.email_service import (
    build_alert_html,
    build_alert_subject,
    is_email_enabled,
    send_limit_alert_email,
)


def test_is_email_enabled_por_padrao_false(monkeypatch):
    monkeypatch.delenv("EMAIL_ALERTS_ENABLED", raising=False)
    assert is_email_enabled() is False


def test_is_email_enabled_true_quando_flag_ativa(monkeypatch):
    monkeypatch.setenv("EMAIL_ALERTS_ENABLED", "true")
    assert is_email_enabled() is True


def test_build_subject_categoria():
    subject = build_alert_subject(threshold=90, exceeded=False)
    assert "90%" in subject


def test_build_subject_estourado():
    subject = build_alert_subject(threshold=100, exceeded=True)
    assert "estourado" in subject.lower()


def test_build_html_inclui_categoria_e_percentual():
    html = build_alert_html(
        category_name="Alimentacao",
        percent_used=92.5,
        threshold=90,
        exceeded=False,
        spent=925.0,
        limit=1000.0,
        scope="category",
        month="2026-09",
    )
    assert "Alimentacao" in html
    assert "92.5%" in html


@pytest.mark.asyncio
async def test_send_email_quando_desabilitado_nao_chama_api(monkeypatch):
    monkeypatch.setenv("EMAIL_ALERTS_ENABLED", "false")
    enviado = await send_limit_alert_email(
        "a@b.com", category_name="X", percent_used=80.0, threshold=80
    )
    assert enviado is False


@pytest.mark.asyncio
async def test_send_email_sucesso_marca_enviado(monkeypatch):
    monkeypatch.setenv("EMAIL_ALERTS_ENABLED", "true")
    monkeypatch.setenv("RESEND_API_KEY", "test_key")
    monkeypatch.setenv("EMAIL_FROM", "Placo <onboarding@resend.dev>")

    mock_resp = AsyncMock()
    mock_resp.status_code = 200
    mock_post = AsyncMock(return_value=mock_resp)
    with patch("app.services.email_service.httpx.AsyncClient.post", mock_post):
        enviado = await send_limit_alert_email(
            "user@teste.com",
            category_name="Alimentacao",
            percent_used=85.0,
            threshold=80,
            exceeded=False,
            spent=850.0,
            limit=1000.0,
            scope="category",
            month="2026-09",
        )
    assert enviado is True
    mock_post.assert_awaited_once()
    call_kwargs = mock_post.call_args
    payload = call_kwargs.kwargs["json"]
    assert payload["to"] == ["user@teste.com"]
    assert "Alimentacao" in payload["html"]


@pytest.mark.asyncio
async def test_send_email_falha_nao_levanta(monkeypatch):
    monkeypatch.setenv("EMAIL_ALERTS_ENABLED", "true")
    monkeypatch.setenv("RESEND_API_KEY", "test_key")
    monkeypatch.setenv("EMAIL_FROM", "Placo <onboarding@resend.dev>")

    mock_resp = AsyncMock()
    mock_resp.status_code = 500
    mock_post = AsyncMock(return_value=mock_resp)
    with patch("app.services.email_service.httpx.AsyncClient.post", mock_post):
        enviado = await send_limit_alert_email(
            "user@teste.com",
            category_name="Alimentacao",
            percent_used=85.0,
            threshold=80,
        )
    assert enviado is False
