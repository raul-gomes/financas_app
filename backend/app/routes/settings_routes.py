import random
from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List

from app.db.repositories.settings import SettingsRepository
from app.db.repositories.transacao import TransacaoRepository
from app.schemas.settings import ProfileResponse, ProfileUpdate, BankResponse, BankCreate
from app.logger import log_api_request

router = APIRouter(prefix="/settings", tags=["Configurações"])


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    request: Request,
    repo: SettingsRepository = Depends(),
):
    """Retorna o perfil do usuário (cria um padrão se não existir)."""
    log = log_api_request(method="GET", endpoint=str(request.url))
    user = await repo.get_or_create_default_user()
    log.success("Perfil obtido", user_id=user.id)
    return user


@router.put("/profile", response_model=ProfileResponse)
async def update_profile(
    request: Request,
    payload: ProfileUpdate,
    repo: SettingsRepository = Depends(),
):
    """Atualiza nome, email e/ou senha do perfil."""
    log = log_api_request(method="PUT", endpoint=str(request.url), payload=payload.model_dump())
    user = await repo.update_profile(payload)
    log.success("Perfil atualizado", user_id=user.id)
    return user


@router.get("/banks", response_model=List[BankResponse])
async def list_banks(
    request: Request,
    repo: SettingsRepository = Depends(),
):
    """Lista os bancos adicionados pelo usuário."""
    log = log_api_request(method="GET", endpoint=str(request.url))
    user = await repo.get_or_create_default_user()
    banks = await repo.list_banks(user.id)
    log.success(f"{len(banks)} bancos listados")
    return banks


@router.post("/banks", response_model=BankResponse, status_code=status.HTTP_201_CREATED)
async def add_bank(
    request: Request,
    payload: BankCreate,
    repo: SettingsRepository = Depends(),
):
    """Adiciona um banco à lista do usuário."""
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    user = await repo.get_or_create_default_user()
    bank = await repo.add_bank(user.id, payload)
    log.success("Banco adicionado", bank_id=bank.id, bank_name=bank.bank_name)
    return bank


@router.delete("/banks/{bank_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_bank(
    request: Request,
    bank_id: int,
    repo: SettingsRepository = Depends(),
):
    """Remove um banco da lista do usuário."""
    log = log_api_request(method="DELETE", endpoint=str(request.url))
    user = await repo.get_or_create_default_user()
    removed = await repo.remove_bank(bank_id, user.id)
    if not removed:
        log.error("Banco nao encontrado", bank_id=bank_id)
        raise HTTPException(status_code=404, detail="Banco não encontrado")
    log.success("Banco removido", bank_id=bank_id)


@router.post("/assign-random-banks")
async def assign_random_banks(
    request: Request,
    settings_repo: SettingsRepository = Depends(),
    transacao_repo: TransacaoRepository = Depends(),
):
    """Atribui um banco aleatório às transações que não possuem bank_code."""
    log = log_api_request(method="POST", endpoint=str(request.url))
    user = await settings_repo.get_or_create_default_user()
    banks = await settings_repo.list_banks(user.id)

    if not banks:
        raise HTTPException(status_code=400, detail="Nenhum banco cadastrado. Adicione bancos primeiro.")

    updated = await transacao_repo.assign_random_banks([b.bank_code for b in banks])

    log.success(f"{updated} transações atualizadas com banco aleatório")
    return {"updated": updated}
