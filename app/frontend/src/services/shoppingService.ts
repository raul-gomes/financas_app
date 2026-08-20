import type { ShoppingItem, ShoppingItemCreate, ShoppingItemUpdate } from '@/types/shopping';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const ShoppingService = {
  async listByMonth(month: string, entityType?: string): Promise<ShoppingItem[]> {
    const params = new URLSearchParams({ month });
    if (entityType) params.set('entity_type', entityType);
    const res = await fetch(`${API_BASE_URL}/shopping/?${params}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao listar itens`);
    return res.json();
  },

  async create(payload: ShoppingItemCreate): Promise<ShoppingItem> {
    const res = await fetch(`${API_BASE_URL}/shopping/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao criar item`);
    return res.json();
  },

  async update(id: number, payload: ShoppingItemUpdate): Promise<ShoppingItem> {
    const res = await fetch(`${API_BASE_URL}/shopping/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao atualizar item`);
    return res.json();
  },

  async delete(id: number): Promise<ShoppingItem> {
    const res = await fetch(`${API_BASE_URL}/shopping/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao excluir item`);
    return res.json();
  },

  async migrar(sourceMonth: string, targetMonth: string): Promise<{ message: string; quantity: number }> {
    const res = await fetch(
      `${API_BASE_URL}/shopping/migrate?source_month=${encodeURIComponent(sourceMonth)}&target_month=${encodeURIComponent(targetMonth)}`,
      { method: 'POST' }
    );
    if (!res.ok) throw new Error(`Erro ${res.status} ao migrar itens`);
    return res.json();
  },
};
