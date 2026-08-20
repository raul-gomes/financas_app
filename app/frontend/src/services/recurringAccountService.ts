import {
  ContaRecorrente,
  ContaRecorrenteCreate,
  ContaRecorrenteUpdate,
  GenerateResponse,
} from '@/types/recurringAccount';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class ContaRecorrenteService {
  static async getAll(entityType?: string): Promise<ContaRecorrente[]> {
    let url = `${API_BASE_URL}/recurring-accounts/`;
    if (entityType) url += `?entity_type=${entityType}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erro ${res.status} ao listar contas recorrentes`);
    return res.json();
  }

  static async getById(id: number): Promise<ContaRecorrente> {
    const res = await fetch(`${API_BASE_URL}/recurring-accounts/${id}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar conta recorrente`);
    return res.json();
  }

  static async create(payload: ContaRecorrenteCreate): Promise<ContaRecorrente> {
    const res = await fetch(`${API_BASE_URL}/recurring-accounts/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao criar conta recorrente`);
    return res.json();
  }

  static async update(id: number, payload: ContaRecorrenteUpdate): Promise<ContaRecorrente> {
    const res = await fetch(`${API_BASE_URL}/recurring-accounts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao atualizar conta recorrente`);
    return res.json();
  }

  static async delete(id: number): Promise<ContaRecorrente> {
    const res = await fetch(`${API_BASE_URL}/recurring-accounts/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao deletar conta recorrente`);
    return res.json();
  }

  static async renew(id: number): Promise<ContaRecorrente> {
    const res = await fetch(`${API_BASE_URL}/recurring-accounts/${id}/renew`, {
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao renovar conta recorrente`);
    return res.json();
  }

  static async generate(startDate: Date, endDate: Date): Promise<GenerateResponse> {
    const payload = {
      start_date: startDate.toISOString(),
      end_date: endDate.toISOString(),
    };
    const res = await fetch(`${API_BASE_URL}/recurring-accounts/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao gerar contas recorrentes`);
    return res.json();
  }
}
