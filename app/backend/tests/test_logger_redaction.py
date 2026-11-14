"""Sensitive fields never reach the logs (pendencias S1)."""

import json

import pytest
from loguru import logger

from app.logger import REDACTED, log_api_request, redact

SECRET_PASSWORD = "senha-super-secreta-123"
SECRET_PLUGGY = "pluggy-key-abcdef-987654"


@pytest.fixture
def captured() -> list[str]:
    """Capture serialized log records."""
    lines: list[str] = []
    sink_id = logger.add(lines.append, serialize=True, level="DEBUG")
    yield lines
    logger.remove(sink_id)


def test_redact_masks_sensitive_keys_recursively() -> None:
    data = {
        "name": "Ana",
        "password": SECRET_PASSWORD,
        "pluggy_api_key": SECRET_PLUGGY,
        "nested": {"access_token": "tok", "items": [{"client_secret": "x"}]},
    }

    result = redact(data)

    assert result["name"] == "Ana"
    assert result["password"] == REDACTED
    assert result["pluggy_api_key"] == REDACTED
    assert result["nested"]["access_token"] == REDACTED
    assert result["nested"]["items"][0]["client_secret"] == REDACTED


def test_redact_keeps_empty_values_visible() -> None:
    assert redact({"password": None, "pluggy_api_key": ""}) == {
        "password": None,
        "pluggy_api_key": "",
    }


def test_log_api_request_never_writes_secret_values(captured: list[str]) -> None:
    log = log_api_request(
        method="PUT",
        endpoint="/settings/profile",
        payload={"name": "Ana", "password": SECRET_PASSWORD, "pluggy_api_key": SECRET_PLUGGY},
    )
    log.info("Atualizando perfil")

    output = "\n".join(captured)
    assert SECRET_PASSWORD not in output
    assert SECRET_PLUGGY not in output
    record = json.loads(captured[-1])["record"]
    assert record["extra"]["payload"]["password"] == REDACTED
