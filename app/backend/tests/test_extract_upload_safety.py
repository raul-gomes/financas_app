"""Upload safety: hostile OFX (entity expansion) and bounded reading of oversized files."""

from io import BytesIO

import pytest
from starlette.datastructures import UploadFile

from app.routes.extract_routes import MAX_UPLOAD_SIZE

BILLION_LAUGHS_OFX = b"""<?xml version="1.0"?>
<!DOCTYPE lolz [
 <!ENTITY lol "lol">
 <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
 <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
]>
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><DTPOSTED>20260101</DTPOSTED><TRNAMT>-10.00</TRNAMT><MEMO>&lol3;</MEMO></STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>"""


@pytest.mark.asyncio
async def test_upload_ofx_with_entity_expansion_is_rejected(client):
    files = {"file": ("bomb.ofx", BytesIO(BILLION_LAUGHS_OFX), "application/x-ofx")}

    response = await client.post("/extracts/upload", files=files)

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_upload_just_above_limit_returns_413(client):
    files = {"file": ("big.csv", BytesIO(b"a" * (MAX_UPLOAD_SIZE + 1)), "text/csv")}

    response = await client.post("/extracts/upload", files=files)

    assert response.status_code == 413


@pytest.mark.asyncio
async def test_upload_stops_reading_once_limit_is_exceeded(client, monkeypatch):
    """The oversized file must not be read whole: reading happens in bounded chunks."""
    requested_sizes: list[int] = []
    original_read = UploadFile.read

    async def spy_read(self, size: int = -1):
        requested_sizes.append(size)
        return await original_read(self, size)

    monkeypatch.setattr(UploadFile, "read", spy_read)
    files = {"file": ("big.csv", BytesIO(b"a" * (MAX_UPLOAD_SIZE * 2)), "text/csv")}

    response = await client.post("/extracts/upload", files=files)

    assert response.status_code == 413
    assert requested_sizes
    assert all(0 < size < MAX_UPLOAD_SIZE for size in requested_sizes)
    # Stopped right after crossing the limit, far from reading all 2x the limit.
    assert len(requested_sizes) * max(requested_sizes) < MAX_UPLOAD_SIZE * 1.5
