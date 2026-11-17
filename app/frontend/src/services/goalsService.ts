import { apiFetch } from '@/lib/api';
import { parseResponse } from '@/lib/parse';
import { metaSchema, metaListSchema, metaProgressoListSchema } from '@/schemas/goals';
import type { Meta, MetaCreate, MetaUpdate, MetaProgresso } from '@/types/goals';

const HTTP_CONFLICT = 409;
const GOAL_DELETE_CONFLICT_FALLBACK = 'Meta possui lançamentos vinculados';

/** The server refused to delete a goal (it has contributions); the message is user-facing. */
export class GoalDeleteRefusedError extends Error {}

export const MetasService = {
  async list(entityType?: string): Promise<Meta[]> {
    let url = `/goals/`;
    if (entityType) url += `?entity_type=${entityType}`;
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`Erro ${res.status} ao listar metas`);
    return parseResponse(res, metaListSchema, 'listar metas');
  },

  async create(payload: MetaCreate): Promise<Meta> {
    const res = await apiFetch(`/goals/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao criar meta`);
    return parseResponse(res, metaSchema, 'criar meta');
  },

  async update(id: number, payload: MetaUpdate): Promise<Meta> {
    const res = await apiFetch(`/goals/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao atualizar meta`);
    return parseResponse(res, metaSchema, 'atualizar meta');
  },

  async delete(id: number): Promise<Meta> {
    const res = await apiFetch(`/goals/${id}`, { method: 'DELETE' });
    if (res.status === HTTP_CONFLICT) {
      // A goal with contributions is refused; the server says why (shown to the user as is)
      const body = (await res.json().catch(() => null)) as { detail?: unknown } | null;
      throw new GoalDeleteRefusedError(typeof body?.detail === 'string' ? body.detail : GOAL_DELETE_CONFLICT_FALLBACK);
    }
    if (!res.ok) throw new Error(`Erro ${res.status} ao excluir meta`);
    return parseResponse(res, metaSchema, 'excluir meta');
  },

  async progresso(year: number, month: number, completed?: boolean, entityType?: string): Promise<MetaProgresso[]> {
    let url = `/goals/progress?year=${year}&month=${month}`;
    if (completed !== undefined) url += `&completed=${completed}`;
    if (entityType) url += `&entity_type=${entityType}`;
    const res = await apiFetch(url);
    if (!res.ok) throw new Error(`Erro ${res.status} ao calcular progresso`);
    return parseResponse(res, metaProgressoListSchema, 'calcular progresso');
  },

  async concluir(id: number): Promise<Meta> {
    const res = await apiFetch(`/goals/${id}/complete`, { method: 'PUT' });
    if (!res.ok) throw new Error(`Erro ${res.status} ao concluir meta`);
    return parseResponse(res, metaSchema, 'concluir meta');
  },

  async reativar(id: number): Promise<Meta> {
    const res = await apiFetch(`/goals/${id}/reactivate`, { method: 'PUT' });
    if (!res.ok) throw new Error(`Erro ${res.status} ao reativar meta`);
    return parseResponse(res, metaSchema, 'reativar meta');
  },
};