"""Settings routes: HTTP concerns only. Rules and authorization live in SettingsService."""

from fastapi import APIRouter, Depends, Request, status

from app.logger import log_api_request
from app.routes.dependencies import get_settings_reader, get_settings_service
from app.schemas.settings import BankCreate, BankResponse, ProfileResponse, ProfileUpdate
from app.services.settings_service import SettingsService

router = APIRouter(prefix="/settings", tags=["Configurações"])


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    request: Request,
    service: SettingsService = Depends(get_settings_reader),
):
    """Retorna o perfil do usuário autenticado."""
    log = log_api_request(method="GET", endpoint=str(request.url))
    user = service.profile()
    log.success("Perfil obtido", user_id=user.id)
    return user


@router.put("/profile", response_model=ProfileResponse)
async def update_profile(
    request: Request,
    payload: ProfileUpdate,
    service: SettingsService = Depends(get_settings_service),
):
    """Atualiza o nome e/ou a chave Pluggy do perfil (e-mail e senha ficam no Supabase)."""
    log = log_api_request(
        method="PUT", endpoint=str(request.url), fields=sorted(payload.model_fields_set)
    )
    user = await service.update_profile(payload)
    log.success("Perfil atualizado", user_id=user.id)
    return user


@router.get("/banks", response_model=list[BankResponse])
async def list_banks(
    request: Request,
    service: SettingsService = Depends(get_settings_reader),
):
    """Lista os bancos adicionados pelo usuário."""
    log = log_api_request(method="GET", endpoint=str(request.url))
    banks = await service.list_banks()
    log.success(f"{len(banks)} bancos listados")
    return banks


@router.post("/banks", response_model=BankResponse, status_code=status.HTTP_201_CREATED)
async def add_bank(
    request: Request,
    payload: BankCreate,
    service: SettingsService = Depends(get_settings_service),
):
    """Adiciona um banco à lista do usuário."""
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    bank = await service.add_bank(payload)
    log.success("Banco adicionado", bank_id=bank.id, bank_name=bank.bank_name)
    return bank


@router.delete("/banks/{bank_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_bank(
    request: Request,
    bank_id: int,
    service: SettingsService = Depends(get_settings_service),
):
    """Remove um banco da lista do usuário."""
    log = log_api_request(method="DELETE", endpoint=str(request.url))
    await service.remove_bank(bank_id)
    log.success("Banco removido", bank_id=bank_id)


@router.post("/assign-random-banks")
async def assign_random_banks(
    request: Request,
    service: SettingsService = Depends(get_settings_service),
):
    """Atribui um banco aleatório às transações que não possuem bank_code."""
    log = log_api_request(method="POST", endpoint=str(request.url))
    updated = await service.assign_random_banks()
    log.success(f"{updated} transações atualizadas com banco aleatório")
    return {"updated": updated}
