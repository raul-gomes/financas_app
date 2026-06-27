const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8005';

export interface Profile {
  id: number;
  name: string;
  email: string;
  pluggy_api_key?: string;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdate {
  name?: string;
  email?: string;
  password?: string;
  pluggy_api_key?: string;
}

export interface PluggyAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
  currencyCode: string;
}

export interface PluggyItem {
  id: string;
  status: string;
  institution_name: string;
  institution_number?: string;
}

export interface SyncResult {
  message: string;
  imported: number;
  accounts: number;
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

  static #banksCache: BrasilApiBank[] | null = null;

  static async searchBrasilApi(query: string): Promise<BrasilApiBank[]> {
    if (query.length < 2) return [];
    if (!this.#banksCache) {
      const res = await fetch(`https://brasilapi.com.br/api/banks/v1`);
      if (!res.ok) return [];
      this.#banksCache = await res.json();
    }
    const allBanks = this.#banksCache;
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

  // ── Meu Pluggy ─────────────────────────────────────────

  static async validatePluggyKey(): Promise<{ valid: boolean; message: string }> {
    const res = await fetch(`${API_BASE_URL}/pluggy/validate-key`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao validar chave`);
    return res.json();
  }

  static async listPluggyAccounts(): Promise<{ accounts: PluggyAccount[]; items: PluggyItem[] }> {
    const res = await fetch(`${API_BASE_URL}/pluggy/accounts`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao listar contas`);
    return res.json();
  }

  static async syncPluggy(): Promise<SyncResult> {
    const res = await fetch(`${API_BASE_URL}/pluggy/sync`, { method: 'POST' });
    if (!res.ok) throw new Error(`Erro ${res.status} ao sincronizar`);
    return res.json();
  }

  // ── Export ──────────────────────────────────────────────

  static getExportCsvUrl(dataInicio: string, dataFinal: string): string {
    return `${API_BASE_URL}/export/csv?data_inicio=${encodeURIComponent(dataInicio)}&data_final=${encodeURIComponent(dataFinal)}`;
  }

  static getExportOfxUrl(dataInicio: string, dataFinal: string): string {
    return `${API_BASE_URL}/export/ofx?data_inicio=${encodeURIComponent(dataInicio)}&data_final=${encodeURIComponent(dataFinal)}`;
  }

  static downloadExport(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }
}
