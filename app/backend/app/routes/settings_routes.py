from fastapi import APIRouter, Depends, Request, status

from app.core.errors import NotFoundError, ValidationError
from app.core.security import get_current_user
from app.db.models.user import UserORM
from app.db.repositories.settings import SettingsRepository
from app.db.repositories.transaction import TransacaoRepository
from app.logger import log_api_request
from app.schemas.settings import BankCreate, BankResponse, ProfileResponse, ProfileUpdate

router = APIRouter(prefix="/settings", tags=["Configurações"])


@router.get("/profile", response_model=ProfileResponse)
async def get_profile(
    request: Request,
    current_user: UserORM = Depends(get_current_user),
    repo: SettingsRepository = Depends(),
):
    """Retorna o perfil do usuário autenticado."""
    log = log_api_request(method="GET", endpoint=str(request.url))
    log.success("Perfil obtido", user_id=current_user.id)
    return current_user


@router.put("/profile", response_model=ProfileResponse)
async def update_profile(
    request: Request,
    payload: ProfileUpdate,
    current_user: UserORM = Depends(get_current_user),
    repo: SettingsRepository = Depends(),
):
    """Atualiza o nome e/ou a chave Pluggy do perfil (e-mail e senha ficam no Supabase)."""
    log = log_api_request(
        method="PUT", endpoint=str(request.url), fields=sorted(payload.model_fields_set)
    )
    user = await repo.update_profile(current_user.id, payload)
    log.success("Perfil atualizado", user_id=user.id)
    return user


@router.get("/banks", response_model=list[BankResponse])
async def list_banks(
    request: Request,
    current_user: UserORM = Depends(get_current_user),
    repo: SettingsRepository = Depends(),
):
    """Lista os bancos adicionados pelo usuário."""
    log = log_api_request(method="GET", endpoint=str(request.url))
    banks = await repo.list_banks(current_user.id)
    log.success(f"{len(banks)} bancos listados")
    return banks


@router.post("/banks", response_model=BankResponse, status_code=status.HTTP_201_CREATED)
async def add_bank(
    request: Request,
    payload: BankCreate,
    current_user: UserORM = Depends(get_current_user),
    repo: SettingsRepository = Depends(),
):
    """Adiciona um banco à lista do usuário."""
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    bank = await repo.add_bank(current_user.id, payload)
    log.success("Banco adicionado", bank_id=bank.id, bank_name=bank.bank_name)
    return bank


@router.delete("/banks/{bank_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_bank(
    request: Request,
    bank_id: int,
    current_user: UserORM = Depends(get_current_user),
    repo: SettingsRepository = Depends(),
):
    """Remove um banco da lista do usuário."""
    log = log_api_request(method="DELETE", endpoint=str(request.url))
    removed = await repo.remove_bank(bank_id, current_user.id)
    if not removed:
        log.error("Banco nao encontrado", bank_id=bank_id)
        raise NotFoundError("Banco não encontrado")
    log.success("Banco removido", bank_id=bank_id)


@router.post("/assign-random-banks")
async def assign_random_banks(
    request: Request,
    current_user: UserORM = Depends(get_current_user),
    settings_repo: SettingsRepository = Depends(),
    transacao_repo: TransacaoRepository = Depends(),
):
    """Atribui um banco aleatório às transações que não possuem bank_code."""
    log = log_api_request(method="POST", endpoint=str(request.url))
    banks = await settings_repo.list_banks(current_user.id)

    if not banks:
        raise ValidationError("Nenhum banco cadastrado. Adicione bancos primeiro.")

    updated = await transacao_repo.assign_random_banks(
        [b.bank_code for b in banks], current_user.id
    )

    log.success(f"{updated} transações atualizadas com banco aleatório")
    return {"updated": updated}
