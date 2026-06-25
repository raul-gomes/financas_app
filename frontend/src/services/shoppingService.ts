import type { ShoppingItem, ShoppingItemCreate, ShoppingItemUpdate } from '@/types/shopping';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8005';

export const ShoppingService = {
  async listByMonth(mes: string): Promise<ShoppingItem[]> {
    const res = await fetch(`${API_BASE_URL}/shopping/?mes=${encodeURIComponent(mes)}`);
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

  async migrar(mes_origem: string, mes_destino: string): Promise<{ mensagem: string; quantidade: number }> {
    const res = await fetch(
      `${API_BASE_URL}/shopping/migrar?mes_origem=${encodeURIComponent(mes_origem)}&mes_destino=${encodeURIComponent(mes_destino)}`,
      { method: 'POST' }
    );
    if (!res.ok) throw new Error(`Erro ${res.status} ao migrar itens`);
    return res.json();
  },
};
