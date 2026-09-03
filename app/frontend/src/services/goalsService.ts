import { apiFetch } from '@/lib/api';
import type { Meta, MetaCreate, MetaUpdate, MetaProgresso } from '@/types/goals';

export const MetasService = {
  async list(entityType?: string): Promise<Meta[]> {
    let url = `/goals/`;
    if (entityType) url += `?entity_type=${entityType}`;
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`Erro ${res.status} ao listar metas`);
    return res.json();
  },

  async create(payload: MetaCreate): Promise<Meta> {
    const res = await apiFetch(`/goals/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao criar meta`);
    return res.json();
  },

  async update(id: number, payload: MetaUpdate): Promise<Meta> {
    const res = await apiFetch(`/goals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao atualizar meta`);
    return res.json();
  },

  async delete(id: number): Promise<Meta> {
    const res = await apiFetch(`/goals/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Erro ${res.status} ao excluir meta`);
    return res.json();
  },

  async progresso(year: number, month: number, completed?: boolean, entityType?: string): Promise<MetaProgresso[]> {
    let url = `/goals/progress?year=${year}&month=${month}`;
    if (completed !== undefined) url += `&completed=${completed}`;
    if (entityType) url += `&entity_type=${entityType}`;
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`Erro ${res.status} ao calcular progresso`);
    return res.json();
  },

  async concluir(id: number): Promise<Meta> {
    const res = await apiFetch(`/goals/${id}/complete`, { method: 'PUT' });
    if (!res.ok) throw new Error(`Erro ${res.status} ao concluir meta`);
    return res.json();
  },

  async reativar(id: number): Promise<Meta> {
    const res = await apiFetch(`/goals/${id}/reactivate`, { method: 'PUT' });
    if (!res.ok) throw new Error(`Erro ${res.status} ao reativar meta`);
    return res.json();
  },
};