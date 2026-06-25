import type { Meta, MetaCreate, MetaUpdate, MetaProgresso } from '@/types/metas';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8005';

export const MetasService = {
  async list(): Promise<Meta[]> {
    const res = await fetch(`${API_BASE_URL}/metas/`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao listar metas`);
    return res.json();
  },

  async create(payload: MetaCreate): Promise<Meta> {
    const res = await fetch(`${API_BASE_URL}/metas/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao criar meta`);
    return res.json();
  },

  async update(id: number, payload: MetaUpdate): Promise<Meta> {
    const res = await fetch(`${API_BASE_URL}/metas/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao atualizar meta`);
    return res.json();
  },

  async delete(id: number): Promise<Meta> {
    const res = await fetch(`${API_BASE_URL}/metas/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao excluir meta`);
    return res.json();
  },

  async progresso(ano: number, mes: number, concluida?: boolean): Promise<MetaProgresso[]> {
    let url = `${API_BASE_URL}/metas/progresso?ano=${ano}&mes=${mes}`;
    if (concluida !== undefined) url += `&concluida=${concluida}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Erro ${res.status} ao calcular progresso`);
    return res.json();
  },

  async concluir(id: number): Promise<Meta> {
    const res = await fetch(`${API_BASE_URL}/metas/${id}/concluir`, { method: 'PUT' });
    if (!res.ok) throw new Error(`Erro ${res.status} ao concluir meta`);
    return res.json();
  },

  async reativar(id: number): Promise<Meta> {
    const res = await fetch(`${API_BASE_URL}/metas/${id}/reativar`, { method: 'PUT' });
    if (!res.ok) throw new Error(`Erro ${res.status} ao reativar meta`);
    return res.json();
  },
};
