import {
  FinancialSummary,
  YearlyPerformance,
  CategoryBreakdown,
  IncomeBySubcategoria,
  Transaction,
  LimitsPayload,
  CategorySubcategories,
  Category,
  LimitsUpdateResponse,
  DuplicateCheckResponse,
} from '@/types/financial';

// Base real do backend
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export class FinancialService {
  // Helper: converte 'pf'/'pj' (legado do frontend) para 'individual'/'business'
  private static mapEntityType(entityType?: string): string | undefined {
    if (!entityType || entityType === 'all') return undefined;
    if (entityType === 'pf') return 'individual';
    if (entityType === 'pj') return 'business';
    return entityType;
  }

  // 1. Extrato financeiro completo (agora recebe natureza opcional)
  static async getFinancialSummary(
    dateRange: { from: Date; to: Date },
    entityType?: string
  ): Promise<FinancialSummary> {
    const mapped = FinancialService.mapEntityType(entityType);
    const params = new URLSearchParams({
      start_date: dateRange.from.toLocaleDateString('pt-BR'),
      end_date: dateRange.to.toLocaleDateString('pt-BR'),
      entity_type: mapped || 'individual'
    });
    const res = await fetch(`${API_BASE_URL}/dashboard/statement?${params}`);
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao buscar extrato financeiro`);
    }
    return res.json();
  }

  // 2. Rendimento anual (performance mensal) com filtro de natureza
  static async getYearlyPerformance(
    year: number,
    entityType?: string
  ): Promise<YearlyPerformance> {
    const mapped = FinancialService.mapEntityType(entityType);
    const params = new URLSearchParams({
      year: year.toString(),
      ...(mapped ? { entity_type: mapped } : {})
    });
    const res = await fetch(
      `${API_BASE_URL}/dashboard/period-income?${params}`
    );
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao buscar rendimento anual`);
    }
    return res.json();
  }

  // 3. Gastos por categoria (saídas) com filtro de natureza
  static async getCategoryBreakdown(
    dateRange: { from: Date; to: Date },
    entityType?: string,
    type: string = 'expense',
  ): Promise<CategoryBreakdown> {
    const mapped = FinancialService.mapEntityType(entityType);
    const params = new URLSearchParams({
      start_date: dateRange.from.toLocaleDateString('pt-BR'),
      end_date: dateRange.to.toLocaleDateString('pt-BR'),
      type: type,
      entity_type: mapped || 'individual'
    })
    const res = await fetch(
      `${API_BASE_URL}/dashboard/expenses-by-category?${params}`
    )
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao buscar gastos por categoria`)
    }
    return res.json()
  }

  // 4. Entradas por subcategoria
  static async getCategoryIncome(
    dateRange: { from: Date; to: Date },
    entityType?: string
  ): Promise<IncomeBySubcategoria> {
    const mapped = FinancialService.mapEntityType(entityType);
    const params = new URLSearchParams({
      start_date: dateRange.from.toLocaleDateString('pt-BR'),
      end_date: dateRange.to.toLocaleDateString('pt-BR'),
      entity_type: mapped || 'individual'
    });
    const res = await fetch(
      `${API_BASE_URL}/dashboard/income-by-category?${params}`
    );
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao buscar entradas por subcategoria`);
    }
    return res.json();
  }

  // 5. Mapa de categoria → subcategorias (opcional natureza e tipo)
  static async getCategorySubcategories(
    entityType?: string,
    type?: string
  ): Promise<CategorySubcategories> {
    const params = new URLSearchParams()
    const mapped = FinancialService.mapEntityType(entityType);
    if (mapped) params.set('entity_type', mapped)
    if (type) params.set('type', type)
    const query = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`${API_BASE_URL}/dashboard/category-options${query}`)
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao buscar categorias`)
    }
    return res.json()
  }

  // 7. Transacoes do ano inteiro (para o grafico anual)
  static async getYearTransactions(
    year: number,
    entityType?: string
  ): Promise<Transaction[]> {
    const mapped = FinancialService.mapEntityType(entityType);
    const from = new Date(year, 0, 1);
    const to = new Date(year, 11, 31);
    const params = new URLSearchParams({
      start_date: from.toLocaleDateString('pt-BR'),
      end_date: to.toLocaleDateString('pt-BR'),
      ...(mapped ? { entity_type: mapped } : {}),
    });
    const res = await fetch(`${API_BASE_URL}/transacoes/?${params}`);
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao buscar transacoes do ano`);
    }
    return res.json();
  }

  // 8. Verificar duplicatas (single ou bulk)
  static async checkDuplicates(
    params: { transaction_date?: string; amount?: number; transactions?: Array<{ index: number; transaction_date: string; amount: number }> }
  ): Promise<DuplicateCheckResponse> {
    const res = await fetch(`${API_BASE_URL}/transacoes/check-duplicates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao verificar duplicatas`);
    }
    return res.json();
  }

  // 9. Adicionar transação
  static async addTransaction(
    transaction: Omit<Transaction, 'id'>
  ): Promise<void> {
    console.log('adicionar', transaction)

    const res = await fetch(`${API_BASE_URL}/transacoes/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    });
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`Erro ${res.status} ao adicionar transação: ${errorBody}`);
    }
  }

  // 9. Atualizar transação
  static async updateTransaction(
    id: number,
    transaction: Partial<Transaction>
  ): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/transacoes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transaction)
    });
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao atualizar transação`);
    }
  }

  // 10. Deletar transação
  static async deleteTransaction(id: number): Promise<void> {
    const res = await fetch(`${API_BASE_URL}/transacoes/${id}`, {
      method: 'DELETE'
    });
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao deletar transação`);
    }
  }

  static async getLimits(): Promise<LimitsPayload> {
    const res = await fetch(`${API_BASE_URL}/categories/`);
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    return res.json();
  }

  static async saveLimits(payload: { new: Category[], modified: Category[], deleted?: number[] }): Promise<LimitsUpdateResponse> {
    const res = await fetch(`${API_BASE_URL}/limits/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`Erro ${res.status}`);
    return res.json();
  }
}
