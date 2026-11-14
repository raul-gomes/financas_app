import { apiFetch } from '@/lib/api';
import { parseResponse } from '@/lib/parse';
import { shoppingItemSchema, shoppingItemListSchema } from '@/schemas/shopping';
import type { ShoppingItem, ShoppingItemCreate, ShoppingItemUpdate } from '@/types/shopping';

export const ShoppingService = {
  async listByMonth(month: string, entityType?: string): Promise<ShoppingItem[]> {
    const params = new URLSearchParams({ month });
    if (entityType) params.set('entity_type', entityType);
    const res = await apiFetch(`/shopping/?${params}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao listar itens`);
    return parseResponse(res, shoppingItemListSchema, 'listar itens');
  },

  async create(payload: ShoppingItemCreate): Promise<ShoppingItem> {
    const res = await apiFetch(`/shopping/`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao criar item`);
    return parseResponse(res, shoppingItemSchema, 'criar item');
  },

  async update(id: number, payload: ShoppingItemUpdate): Promise<ShoppingItem> {
    const res = await apiFetch(`/shopping/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao atualizar item`);
    return parseResponse(res, shoppingItemSchema, 'atualizar item');
  },

  async delete(id: number): Promise<ShoppingItem> {
    const res = await apiFetch(`/shopping/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Erro ${res.status} ao excluir item`);
    return parseResponse(res, shoppingItemSchema, 'excluir item');
  },
};
