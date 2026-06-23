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
    return allBanks.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.fullName.toLowerCase().includes(q) ||
        (b.code?.toString() || '').includes(q)
    ).slice(0, 10);
  }
}
