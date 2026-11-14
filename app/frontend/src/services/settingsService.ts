import type { z } from 'zod';
import { apiFetch } from '@/lib/api';
import { parseApi, parseResponse } from '@/lib/parse';
import {
  profileSchema, userBankSchema, userBankListSchema, brasilApiBankListSchema,
  brasilApiBankSchema, pluggyValidateSchema, pluggyAccountsSchema, syncResultSchema,
} from '@/schemas/settings';

/** The pluggy key itself never leaves the backend (only `has_pluggy_key`). */
export type Profile = z.infer<typeof profileSchema>;

/** E-mail and password are changed through Supabase Auth, not this API. */
export interface ProfileUpdate {
  name?: string;
  /** Empty string removes the stored key. */
  pluggy_api_key?: string;
}

export type PluggyAccountsResponse = z.infer<typeof pluggyAccountsSchema>;
export type PluggyAccount = PluggyAccountsResponse['accounts'][number];
export type PluggyItem = PluggyAccountsResponse['items'][number];
export type SyncResult = z.infer<typeof syncResultSchema>;
export type UserBank = z.infer<typeof userBankSchema>;
export type BrasilApiBank = z.infer<typeof brasilApiBankSchema>;

export interface BankCreate {
  bank_code: string;
  bank_name: string;
}

export class SettingsService {
  static async getProfile(): Promise<Profile> {
    const res = await apiFetch(`/settings/profile`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao obter perfil`);
    return parseResponse(res, profileSchema, 'obter perfil');
  }

  static async updateProfile(payload: ProfileUpdate): Promise<Profile> {
    const res = await apiFetch(`/settings/profile`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao atualizar perfil`);
    return parseResponse(res, profileSchema, 'atualizar perfil');
  }

  static async listBanks(): Promise<UserBank[]> {
    const res = await apiFetch(`/settings/banks`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao listar bancos`);
    return parseResponse(res, userBankListSchema, 'listar bancos');
  }

  static async addBank(payload: BankCreate): Promise<UserBank> {
    const res = await apiFetch(`/settings/banks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao adicionar banco`);
    return parseResponse(res, userBankSchema, 'adicionar banco');
  }

  static async removeBank(bankId: number): Promise<void> {
    const res = await apiFetch(`/settings/banks/${bankId}`, {
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
      this.#banksCache = await parseResponse(res, brasilApiBankListSchema, 'buscar bancos');
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
    const res = await apiFetch(`/pluggy/validate-key`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao validar chave`);
    return parseResponse(res, pluggyValidateSchema, 'validar chave');
  }

  static async listPluggyAccounts(): Promise<{ accounts: PluggyAccount[]; items: PluggyItem[] }> {
    const res = await apiFetch(`/pluggy/accounts`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao listar contas`);
    return parseResponse(res, pluggyAccountsSchema, 'listar contas');
  }

  static async syncPluggy(): Promise<SyncResult> {
    const res = await apiFetch(`/pluggy/sync`, { method: 'POST' });
    if (!res.ok) throw new Error(`Erro ${res.status} ao sincronizar`);
    return parseResponse(res, syncResultSchema, 'sincronizar');
  }

  // ── Export ──────────────────────────────────────────────

  static getExportCsvUrl(startDate: string, endDate: string): string {
    const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
    return `${API_BASE_URL}/export/csv?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
  }

  static getExportOfxUrl(startDate: string, endDate: string): string {
    const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
    return `${API_BASE_URL}/export/ofx?start_date=${encodeURIComponent(startDate)}&end_date=${encodeURIComponent(endDate)}`;
  }

  static downloadExport(url: string, filename: string) {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }
}