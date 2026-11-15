import { apiFetch } from '@/lib/api';
import { parseResponse } from '@/lib/parse';
import {
  contaRecorrenteSchema, contaRecorrenteListSchema,
} from '@/schemas/recurringAccount';
import {
  ContaRecorrente, ContaRecorrenteCreate,
  ContaRecorrenteUpdate,
} from '@/types/recurringAccount';

export class ContaRecorrenteService {
  static async getAll(entityType?: string): Promise<ContaRecorrente[]> {
    let url = `/recurring-accounts/`;
    if (entityType) url += `?entity_type=${entityType}`;
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`Erro ${res.status} ao listar contas recorrentes`);
    return parseResponse(res, contaRecorrenteListSchema, 'listar contas recorrentes');
  }

  static async getById(id: number): Promise<ContaRecorrente> {
    const res = await apiFetch(`/recurring-accounts/${id}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar conta recorrente`);
    return parseResponse(res, contaRecorrenteSchema, 'buscar conta recorrente');
  }

  static async create(payload: ContaRecorrenteCreate): Promise<ContaRecorrente> {
    const res = await apiFetch(`/recurring-accounts/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao criar conta recorrente`);
    return parseResponse(res, contaRecorrenteSchema, 'criar conta recorrente');
  }

  static async update(id: number, payload: ContaRecorrenteUpdate): Promise<ContaRecorrente> {
    const res = await apiFetch(`/recurring-accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao atualizar conta recorrente`);
    return parseResponse(res, contaRecorrenteSchema, 'atualizar conta recorrente');
  }

  static async delete(id: number): Promise<ContaRecorrente> {
    const res = await apiFetch(`/recurring-accounts/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Erro ${res.status} ao deletar conta recorrente`);
    return parseResponse(res, contaRecorrenteSchema, 'deletar conta recorrente');
  }

  static async renew(id: number): Promise<ContaRecorrente> {
    const res = await apiFetch(`/recurring-accounts/${id}/renew`, { method: 'POST' });
    if (!res.ok) throw new Error(`Erro ${res.status} ao renovar conta recorrente`);
    return parseResponse(res, contaRecorrenteSchema, 'renovar conta recorrente');
  }
}
