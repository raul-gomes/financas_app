import { format } from 'date-fns';
import { apiFetch } from '@/lib/api';
import { parseResponse } from '@/lib/parse';
import {
  financialSummarySchema, yearlyPerformanceSchema, categoryBreakdownSchema,
  incomeBySubcategorySchema, categorySubcategoriesSchema, transactionPageSchema,
  duplicateCheckResponseSchema, limitsPayloadSchema, limitsUpdateResponseSchema,
  limitsWithSpendingSchema,
} from '@/schemas/financial';
import {
  TransactionCreatePayload,
  FinancialSummary, YearlyPerformance, CategoryBreakdown,
  IncomeBySubcategoria, Transaction, TransactionPage, LimitsPayload,
  CategorySubcategories, Category, LimitsUpdateResponse,
  DuplicateCheckResponse, LimitsWithSpending,
} from '@/types/financial';

/** Page size of the transactions list ("Carregar mais" fetches this many more). */
export const TRANSACTIONS_PAGE_SIZE = 30;
/** Largest page the backend accepts (mirrors TRANSACTIONS_MAX_PAGE_SIZE). */
export const TRANSACTIONS_MAX_PAGE_SIZE = 100;
/** Safety cap on pages followed to gather a year of investments (fails instead of truncating). */
export const YEAR_INVESTMENTS_MAX_PAGES = 20;

/** Backend date format (DD/MM/YYYY). */
const API_DATE_FORMAT = 'dd/MM/yyyy';

/** Filters of the paginated transactions list; every field is optional. */
export interface TransactionPageFilters {
  dateRange?: { from: Date; to: Date };
  entityType?: string;
  type?: 'income' | 'expense' | 'investment';
  categoryId?: number;
  search?: string;
}

export class FinancialService {
  private static mapEntityType(entityType?: string): string | undefined {
    if (!entityType || entityType === 'all') return undefined;
    if (entityType === 'pf') return 'individual';
    if (entityType === 'pj') return 'business';
    return entityType;
  }

  /**
   * Scope sent to the dashboard endpoints: "all" (Ambos) asks for both natures; without a
   * scope they keep the backend's default, individual.
   */
  private static dashboardScope(entityType?: string): string {
    if (entityType === 'all') return 'all';
    return FinancialService.mapEntityType(entityType) ?? 'individual';
  }

  static async getFinancialSummary(dateRange: { from: Date; to: Date }, entityType?: string): Promise<FinancialSummary> {
    const params = new URLSearchParams({
      start_date: dateRange.from.toLocaleDateString('pt-BR'),
      end_date: dateRange.to.toLocaleDateString('pt-BR'),
      entity_type: FinancialService.dashboardScope(entityType)
    });
    const res = await apiFetch(`/dashboard/statement?${params}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar extrato financeiro`);
    return parseResponse(res, financialSummarySchema, 'buscar extrato financeiro');
  }

  static async getYearlyPerformance(year: number, entityType?: string): Promise<YearlyPerformance> {
    const params = new URLSearchParams({
      year: year.toString(),
      entity_type: FinancialService.dashboardScope(entityType),
    });
    const res = await apiFetch(`/dashboard/period-income?${params}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar rendimento anual`);
    return parseResponse(res, yearlyPerformanceSchema, 'buscar rendimento anual');
  }

  static async getCategoryBreakdown(dateRange: { from: Date; to: Date }, entityType?: string, type: string = 'expense'): Promise<CategoryBreakdown> {
    const params = new URLSearchParams({
      start_date: dateRange.from.toLocaleDateString('pt-BR'),
      end_date: dateRange.to.toLocaleDateString('pt-BR'),
      type: type,
      entity_type: FinancialService.dashboardScope(entityType)
    });
    const res = await apiFetch(`/dashboard/expenses-by-category?${params}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar gastos por categoria`);
    return parseResponse(res, categoryBreakdownSchema, 'buscar gastos por categoria');
  }

  static async getCategoryIncome(dateRange: { from: Date; to: Date }, entityType?: string): Promise<IncomeBySubcategoria> {
    const params = new URLSearchParams({
      start_date: dateRange.from.toLocaleDateString('pt-BR'),
      end_date: dateRange.to.toLocaleDateString('pt-BR'),
      entity_type: FinancialService.dashboardScope(entityType)
    });
    const res = await apiFetch(`/dashboard/income-by-category?${params}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar entradas por subcategoria`);
    return parseResponse(res, incomeBySubcategorySchema, 'buscar entradas por subcategoria');
  }

  static async getCategorySubcategories(entityType?: string, type?: string): Promise<CategorySubcategories> {
    const params = new URLSearchParams();
    const mapped = FinancialService.mapEntityType(entityType);
    if (mapped) params.set('entity_type', mapped);
    if (type) params.set('type', type);
    const query = params.toString() ? `?${params.toString()}` : '';
    const res = await apiFetch(`/dashboard/category-options${query}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar categorias`);
    return parseResponse(res, categorySubcategoriesSchema, 'buscar categorias');
  }

  /**
   * Fetches one page of the user's transactions (newest first).
   *
   * @param filters - Optional period, PF/PJ, type, category and text filters.
   * @param cursor - `next_cursor` of the previous page; omit for the first page.
   * @param limit - Page size (the backend caps it at TRANSACTIONS_MAX_PAGE_SIZE).
   */
  static async getTransactionsPage(
    filters: TransactionPageFilters,
    cursor?: string | null,
    limit: number = TRANSACTIONS_PAGE_SIZE,
  ): Promise<TransactionPage> {
    const params = new URLSearchParams({ limit: String(limit) });
    if (filters.dateRange) {
      params.set('start_date', format(filters.dateRange.from, API_DATE_FORMAT));
      params.set('end_date', format(filters.dateRange.to, API_DATE_FORMAT));
    }
    const mapped = FinancialService.mapEntityType(filters.entityType);
    if (mapped) params.set('entity_type', mapped);
    if (filters.type) params.set('type', filters.type);
    if (filters.categoryId !== undefined) params.set('category_id', String(filters.categoryId));
    const search = filters.search?.trim();
    if (search) params.set('search', search);
    if (cursor) params.set('cursor', cursor);
    const res = await apiFetch(`/transacoes/paginated?${params}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar transações`);
    return parseResponse(res, transactionPageSchema, 'buscar transações');
  }

  /** Every investment of the year (follows the cursor; fails instead of silently truncating). */
  static async getYearInvestments(year: number, entityType?: string): Promise<Transaction[]> {
    const filters: TransactionPageFilters = {
      dateRange: { from: new Date(year, 0, 1), to: new Date(year, 11, 31) },
      entityType,
      type: 'investment',
    };
    const all: Transaction[] = [];
    let cursor: string | null = null;
    for (let pageNumber = 0; pageNumber < YEAR_INVESTMENTS_MAX_PAGES; pageNumber += 1) {
      const page: TransactionPage = await FinancialService.getTransactionsPage(
        filters,
        cursor,
        TRANSACTIONS_MAX_PAGE_SIZE,
      );
      all.push(...page.items);
      if (!page.has_more) return all;
      cursor = page.next_cursor;
    }
    throw new Error('Investimentos do ano excedem o limite de páginas suportado');
  }

  static async checkDuplicates(params: { transaction_date?: string; amount?: number; transactions?: Array<{ index: number; transaction_date: string; amount: number }> }): Promise<DuplicateCheckResponse> {
    const res = await apiFetch(`/transacoes/check-duplicates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) throw new Error(`Erro ${res.status} ao verificar duplicatas`);
    return parseResponse(res, duplicateCheckResponseSchema, 'verificar duplicatas');
  }

  static async addTransaction(transaction: TransactionCreatePayload): Promise<void> {
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
    return parseResponse(res, limitsPayloadSchema, 'buscar limites');
  }

  static async saveLimits(payload: { new: Record<string, unknown>[], modified: Record<string, unknown>[], deleted?: number[] }): Promise<LimitsUpdateResponse> {
    const res = await apiFetch(`/limits/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    return parseResponse(res, limitsUpdateResponseSchema, 'salvar limites');
  }

  static async getLimitsWithSpending(year: number, month: number): Promise<LimitsWithSpending> {
    const params = new URLSearchParams({ year: year.toString(), month: month.toString() });
    const res = await apiFetch(`/limits/with-spending?${params}`);
    if (!res.ok) throw new Error(`Erro ${res.status} ao buscar limites com gastos`);
    return parseResponse(res, limitsWithSpendingSchema, 'buscar limites com gastos');
  }
}