"""Rows dropped by the CSV parser must be reported in the log (line number, no values)."""

import pytest

from app.logger import logger
from app.services.extract_parsers import parse_csv

SECRET_VALUE = "not-a-number-777"


@pytest.fixture
def log_messages():
    """Collect loguru messages emitted during a test."""
    messages: list[str] = []
    sink_id = logger.add(lambda message: messages.append(str(message)), level="WARNING")
    yield messages
    logger.remove(sink_id)


def test_parse_csv_logs_skipped_line_number_without_values(log_messages):
    content = f"data,descricao,valor\n01/01/2026,Ok,10.00\n02/01/2026,Bad,{SECRET_VALUE}\n"

    result = parse_csv(content)

    assert len(result) == 1
    joined = "".join(log_messages)
    assert "line 3" in joined
    assert SECRET_VALUE not in joined
