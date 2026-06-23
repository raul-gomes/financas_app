const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8005';

export interface Profile {
  id: number;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  name?: string;
  email?: string;
  password?: string;
}

export interface UserBank {
  id: number;
  bank_code: string;
  bank_name: string;
  created_at: string;
}

export interface BankCreate {
  bank_code: string;
  bank_name: string;
}

export interface BrasilApiBank {
  code: string | null;
  name: string;
  fullName: string;
  ispb: string;
}

export class SettingsService {
  static async getProfile(): Promise<Profile> {
    const res = await fetch(`${API_BASE_URL}/settings/profile`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao obter perfil`);
    return res.json();
  }

  static async updateProfile(payload: ProfileUpdate): Promise<Profile> {
    const res = await fetch(`${API_BASE_URL}/settings/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao atualizar perfil`);
    return res.json();
  }

  static async listBanks(): Promise<UserBank[]> {
    const res = await fetch(`${API_BASE_URL}/settings/banks`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao listar bancos`);
    return res.json();
  }

  static async addBank(payload: BankCreate): Promise<UserBank> {
    const res = await fetch(`${API_BASE_URL}/settings/banks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao adicionar banco`);
    return res.json();
  }

  static async removeBank(bankId: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/settings/banks/${bankId}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 204) throw new Error(`Erro ${res.status} ao remover banco`);
  }

  static async searchBrasilApi(query: string): Promise<BrasilApiBank[]> {
    if (query.length < 2) return [];
    const res = await fetch(`https://brasilapi.com.br/api/banks/v1`);
    if (!res.ok) return [];
    const allBanks: BrasilApiBank[] = await res.json();
    const q = query.toLowerCase();

    // Filter banks that match the query
    const matched = allBanks.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.fullName.toLowerCase().includes(q) ||
        (b.code?.toString() || '').includes(q)
    );

    // Sort by relevance: name starts with query > fullName starts with query > name includes > fullName includes > code match
    matched.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      const aFull = a.fullName.toLowerCase();
      const bFull = b.fullName.toLowerCase();

      const aStartsName = aName.startsWith(q) ? 1 : 0;
      const bStartsName = bName.startsWith(q) ? 1 : 0;
      const aStartsFull = aFull.startsWith(q) ? 1 : 0;
      const bStartsFull = bFull.startsWith(q) ? 1 : 0;

      // Score: 4 = exact name match, 3 = name starts with, 2 = fullName starts with, 1 = name contains, 0 = fallback
      const scoreA = aName === q ? 4 : aStartsName ? 3 : aStartsFull ? 2 : aName.includes(q) ? 1 : 0;
      const scoreB = bName === q ? 4 : bStartsName ? 3 : bStartsFull ? 2 : bName.includes(q) ? 1 : 0;

      return scoreB - scoreA;
    });

    return matched.slice(0, 10);
  }
}
