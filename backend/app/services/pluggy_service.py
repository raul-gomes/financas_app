"""
Service for interacting with Meu Pluggy API (meu.pluggy.ai).

Each user has their own API key from meu.pluggy.ai.
This service uses that key to fetch accounts and transactions.
"""
import httpx
from typing import List, Optional
from datetime import date, datetime
from fastapi import HTTPException, status

from app.logger import logger

PLUGGY_API_BASE = "https://api.pluggy.ai"


class PluggyAccount:
    """Represents a bank account from Pluggy."""
    id: str
    type: str  # BANK, CREDIT, INVESTMENT
    subtype: str
    name: str
    balance: float
    currency_code: str
    bank_code: Optional[str] = None
    bank_name: Optional[str] = None


class PluggyTransaction:
    """Represents a financial transaction from Pluggy."""
    id: str
    description: str
    amount: float
    date: date
    type: str  # DEBIT, CREDIT
    status: str  # POSTED, PENDING
    category: str
    account_id: str


class PluggyItem:
    """Represents a connected bank item."""
    id: str
    status: str
    institution_name: str
    institution_number: Optional[str] = None
    created_at: datetime
    last_updated_at: Optional[datetime] = None


class PluggyService:
    """
    Service that wraps the Meu Pluggy REST API.
    Each call requires the user's personal API key.
    """

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.client = httpx.AsyncClient(
            base_url=PLUGGY_API_BASE,
            headers={"X-API-Key": api_key},
            timeout=30,
        )

    async def close(self):
        await self.client.aclose()

    async def _get(self, path: str, params: dict = None) -> dict:
        """Make a GET request to the Pluggy API."""
        try:
            response = await self.client.get(path, params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="API Key inválida. Verifique sua chave no Meu Pluggy."
                )
            logger.error(f"Pluggy API error: {e.response.text}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Erro ao conectar com Meu Pluggy: {e.response.status_code}"
            )
        except httpx.RequestError as e:
            logger.error(f"Pluggy request error: {e}")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="Não foi possível conectar ao Meu Pluggy. Verifique sua conexão."
            )

    async def fetch_items(self) -> List[PluggyItem]:
        """Fetch all connected bank items (connections)."""
        data = await self._get("/items")
        items = []
        for raw in data.get("results", []):
            item = PluggyItem()
            item.id = raw["id"]
            item.status = raw["status"]
            item.institution_name = raw.get("connector", {}).get("name", "Desconhecido")
            item.institution_number = raw.get("connector", {}).get("id")
            item.created_at = raw.get("createdAt")
            item.last_updated_at = raw.get("lastUpdatedAt")
            items.append(item)
        return items

    async def fetch_accounts(self) -> List[dict]:
        """Fetch all accounts from connected banks."""
        data = await self._get("/accounts")
        return data.get("results", [])

    async def fetch_transactions(
        self,
        account_id: str,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
    ) -> List[dict]:
        """Fetch transactions for a specific account."""
        params = {"accountId": account_id}
        if from_date:
            params["from"] = from_date.isoformat()
        if to_date:
            params["to"] = to_date.isoformat()

        all_transactions = []
        page = 1
        total_pages = 1

        while page <= total_pages:
            params["page"] = page
            data = await self._get("/transactions", params)
            all_transactions.extend(data.get("results", []))
            total_pages = data.get("totalPages", 1)
            page += 1

        return all_transactions

    async def validate_api_key(self) -> bool:
        """Test if the API key is valid by fetching items."""
        try:
            await self.fetch_items()
            return True
        except HTTPException:
            return False
