from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List

from app.db.repositories.conta_recorrente import ContaRecorrenteRepository
from app.schemas.conta_recorrente import (
    ContaRecorrenteCreate,
    ContaRecorrenteUpdate,
    ContaRecorrenteResponse,
    GenerateRequest,
    GenerateResponse,
)
from app.logger import log_api_request

router = APIRouter(prefix="/recorrentes", tags=["Contas Recorrentes"])


@router.post("/", response_model=ContaRecorrenteResponse, status_code=status.HTTP_201_CREATED)
async def create_conta_recorrente(
    request: Request,
    payload: ContaRecorrenteCreate,
    repo: ContaRecorrenteRepository = Depends(),
):
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    try:
        result = await repo.create(payload)
        log.info(f"Conta recorrente {result.id} criada")
        return result
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Erro interno ao criar conta recorrente: {e}")
        raise HTTPException(status_code=500, detail="Erro interno")


@router.get("/", response_model=List[ContaRecorrenteResponse])
async def list_contas_recorrentes(
    request: Request,
    repo: ContaRecorrenteRepository = Depends(),
):
    log = log_api_request(method="GET", endpoint=str(request.url))
    try:
        contas = await repo.get_all()
        log.info(f"{len(contas)} contas recorrentes listadas")
        return contas
    except Exception as e:
        log.error(f"Erro ao listar contas recorrentes: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao listar contas recorrentes")


@router.get("/{conta_id}", response_model=ContaRecorrenteResponse)
async def get_conta_recorrente(
    request: Request,
    conta_id: int,
    repo: ContaRecorrenteRepository = Depends(),
):
    log = log_api_request(method="GET", endpoint=str(request.url), conta_id=conta_id)
    conta = await repo.get_by_id(conta_id)
    if not conta:
        log.warning(f"Conta recorrente {conta_id} nao encontrada")
        raise HTTPException(status_code=404, detail="Conta recorrente nao encontrada")
    log.info(f"Conta recorrente {conta_id} retornada")
    return conta


@router.put("/{conta_id}", response_model=ContaRecorrenteResponse)
async def update_conta_recorrente(
    request: Request,
    conta_id: int,
    payload: ContaRecorrenteUpdate,
    repo: ContaRecorrenteRepository = Depends(),
):
    log = log_api_request(method="PUT", endpoint=str(request.url), conta_id=conta_id, payload=payload.model_dump(exclude_unset=True))
    conta = await repo.update(conta_id, payload)
    if not conta:
        log.warning(f"Conta recorrente {conta_id} nao encontrada")
        raise HTTPException(status_code=404, detail="Conta recorrente nao encontrada")
    log.info(f"Conta recorrente {conta_id} atualizada")
    return conta


@router.delete("/{conta_id}", response_model=ContaRecorrenteResponse)
async def delete_conta_recorrente(
    request: Request,
    conta_id: int,
    repo: ContaRecorrenteRepository = Depends(),
):
    log = log_api_request(method="DELETE", endpoint=str(request.url), conta_id=conta_id)
    try:
        deleted = await repo.delete(conta_id)
        if not deleted:
            log.warning(f"Conta recorrente {conta_id} nao encontrada")
            raise HTTPException(status_code=404, detail="Conta recorrente nao encontrada")
        log.info(f"Conta recorrente {conta_id} excluida")
        return deleted
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Erro ao excluir conta recorrente {conta_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno ao excluir conta recorrente")


@router.post("/generate", response_model=GenerateResponse)
async def generate_recurrent_transactions(
    request: Request,
    payload: GenerateRequest,
    repo: ContaRecorrenteRepository = Depends(),
):
    log = log_api_request(method="POST", endpoint=str(request.url), payload=payload.model_dump())
    try:
        geradas, detalhes = await repo.generate_pending_transactions(payload)
        log.info(f"{geradas} transacoes recorrentes geradas")
        return GenerateResponse(geradas=geradas, detalhes=detalhes)
    except HTTPException:
        raise
    except Exception as e:
        log.error(f"Erro ao gerar transacoes recorrentes: {type(e).__name__}: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Erro interno ao gerar transacoes recorrentes: {str(e)}")
