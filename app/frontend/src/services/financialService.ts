import { apiFetch } from '@/lib/api';
import {
  FinancialSummary, YearlyPerformance, CategoryBreakdown,
  IncomeBySubcategoria, Transaction, LimitsPayload,
  CategorySubcategories, Category, LimitsUpdateResponse,
  DuplicateCheckResponse,
} from '@/types/financial';

export class FinancialService {
  private static mapEntityType(entityType?: string): string | undefined {
    if (!entityType || entityType === 'all') return undefined;
    if (entityType === 'pf') return 'individual';
    if (entityType === 'pj') return 'business';
    return entityType;
  }

  static async getFinancialSummary(dateRange: { from: Date; to: Date }, entityType?: string): Promise<FinancialSummary> {
    const mapped = FinancialService.mapEntityType(entityType);
    const params = new URLSearchParams({
      start_date: dateRange.from.toLocaleDateString('pt-BR'),
      end_date: dateRange.to.toLocaleDateString('pt-BR'),
      entity_type: mapped || 'individual'
    });
    const res = await apiFetch(`/dashboard/statement?${params}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar extrato financeiro`);
    return res.json();
  }

  static async getYearlyPerformance(year: number, entityType?: string): Promise<YearlyPerformance> {
    const mapped = FinancialService.mapEntityType(entityType);
    const params = new URLSearchParams({
      year: year.toString(),
      ...(mapped ? { entity_type: mapped } : {})
    });
    const res = await apiFetch(`/dashboard/period-income?${params}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar rendimento anual`);
    return res.json();
  }

  static async getCategoryBreakdown(dateRange: { from: Date; to: Date }, entityType?: string, type: string = 'expense'): Promise<CategoryBreakdown> {
    const mapped = FinancialService.mapEntityType(entityType);
    const params = new URLSearchParams({
      start_date: dateRange.from.toLocaleDateString('pt-BR'),
      end_date: dateRange.to.toLocaleDateString('pt-BR'),
      type: type,
      entity_type: mapped || 'individual'
    });
    const res = await apiFetch(`/dashboard/expenses-by-category?${params}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar gastos por categoria`);
    return res.json();
  }

  static async getCategoryIncome(dateRange: { from: Date; to: Date }, entityType?: string): Promise<IncomeBySubcategoria> {
    const mapped = FinancialService.mapEntityType(entityType);
    const params = new URLSearchParams({
      start_date: dateRange.from.toLocaleDateString('pt-BR'),
      end_date: dateRange.to.toLocaleDateString('pt-BR'),
      entity_type: mapped || 'individual'
    });
    const res = await apiFetch(`/dashboard/income-by-category?${params}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar entradas por subcategoria`);
    return res.json();
  }

  static async getCategorySubcategories(entityType?: string, type?: string): Promise<CategorySubcategories> {
    const params = new URLSearchParams();
    const mapped = FinancialService.mapEntityType(entityType);
    if (mapped) params.set('entity_type', mapped);
    if (type) params.set('type', type);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await apiFetch(`/dashboard/category-options${query}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar categorias`);
    return res.json();
  }

  static async getYearTransactions(year: number, entityType?: string): Promise<Transaction[]> {
    const mapped = FinancialService.mapEntityType(entityType);
    const from = new Date(year, 0, 1);
    const to = new Date(year, 11, 31);
    const params = new URLSearchParams({
      start_date: from.toLocaleDateString('pt-BR'),
      end_date: to.toLocaleDateString('pt-BR'),
      ...(mapped ? { entity_type: mapped } : {}),
    });
    const res = await apiFetch(`/transacoes/?${params}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar transacoes do ano`);
    return res.json();
  }

  static async checkDuplicates(params: { transaction_date?: string; amount?: number; transactions?: Array<{ index: number; transaction_date: string; amount: number }> }): Promise<DuplicateCheckResponse> {
    const res = await apiFetch(`/transacoes/check-duplicates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao verificar duplicatas`);
    return res.json();
  }

  static async addTransaction(transaction: Omit<Transaction, 'id'>): Promise<void> {
    const res = await apiFetch(`/transacoes/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    });
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Erro ${res.status} ao adicionar transação: ${errorBody}`);
    }
  }

  static async updateTransaction(id: number, transaction: Partial<Transaction>): Promise<void> {
    const res = await apiFetch(`/transacoes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao atualizar transação`);
  }

  static async deleteTransaction(id: number): Promise<void> {
    const res = await apiFetch(`/transacoes/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Erro ${res.status} ao deletar transação`);
  }

  static async getLimits(): Promise<LimitsPayload> {
    const res = await apiFetch(`/categories/`);
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    return res.json();
  }

  static async saveLimits(payload: { new: Category[], modified: Category[], deleted?: number[] }): Promise<LimitsUpdateResponse> {
    const res = await apiFetch(`/limits/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    return res.json();
  }
}