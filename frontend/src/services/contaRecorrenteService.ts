import {
  ContaRecorrente,
  ContaRecorrenteCreate,
  ContaRecorrenteUpdate,
  GenerateResponse,
} from '@/types/conta_recorrente';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8005';

export class ContaRecorrenteService {
  static async getAll(): Promise<ContaRecorrente[]> {
    const res = await fetch(`${API_BASE_URL}/recorrentes/`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao listar contas recorrentes`);
    return res.json();
  }

  static async getById(id: number): Promise<ContaRecorrente> {
    const res = await fetch(`${API_BASE_URL}/recorrentes/${id}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar conta recorrente`);
    return res.json();
  }

  static async create(payload: ContaRecorrenteCreate): Promise<ContaRecorrente> {
    const res = await fetch(`${API_BASE_URL}/recorrentes/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao criar conta recorrente`);
    return res.json();
  }

  static async update(id: number, payload: ContaRecorrenteUpdate): Promise<ContaRecorrente> {
    const res = await fetch(`${API_BASE_URL}/recorrentes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao atualizar conta recorrente`);
    return res.json();
  }

  static async delete(id: number): Promise<ContaRecorrente> {
    const res = await fetch(`${API_BASE_URL}/recorrentes/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao deletar conta recorrente`);
    return res.json();
  }

  static async generate(dataInicio: Date, dataFinal: Date): Promise<GenerateResponse> {
    const payload = {
      data_inicio: dataInicio.toISOString(),
      data_final: dataFinal.toISOString(),
    };
    const res = await fetch(`${API_BASE_URL}/recorrentes/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao gerar contas recorrentes`);
    return res.json();
  }
}
