import {
  FinancialSummary,
  YearlyPerformance,
  CategoryBreakdown,
  Transaction,
  LimitsPayload,
  CategorySubcategories,
  Category,
  LimitsUpdateResponse,
  DuplicateCheckResponse,
  DuplicateResolution,
  ResolveDuplicatesResponse,
} from '@/types/financial';

// Base real do backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8005';

export class FinancialService {
  // 1. Extrato financeiro completo (agora recebe natureza opcional)
  static async getFinancialSummary(
    dateRange: { from: Date; to: Date },
    natureza?: 'pf' | 'pj' | 'all'
  ): Promise<FinancialSummary> {
    const params = new URLSearchParams({
      data_inicio: dateRange.from.toLocaleDateString('pt-BR'),
      data_final: dateRange.to.toLocaleDateString('pt-BR'),
      natureza: natureza || 'pf'
    });
    const res = await fetch(`${API_BASE_URL}/dashboard/extrato?${params}`);
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao buscar extrato financeiro`);
    }
    return res.json();
  }

  // 2. Rendimento anual (performance mensal) com filtro de natureza
  static async getYearlyPerformance(
    year: number,
    natureza?: 'pf' | 'pj' | 'all'
  ): Promise<YearlyPerformance> {
    const params = new URLSearchParams({
      ano: year.toString(),
      ...(natureza && natureza !== 'all' ? { natureza } : {})
    });
    const res = await fetch(
      `${API_BASE_URL}/dashboard/rendimento-periodo?${params}`
    );
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao buscar rendimento anual`);
    }
    return res.json();
  }

  // 3. Gastos por categoria (saídas) com filtro de natureza
  static async getCategoryBreakdown(
    dateRange: { from: Date; to: Date },
    natureza?: 'pf' | 'pj' | 'all',
    tipo: string = 'saida',
  ): Promise<CategoryBreakdown> {
    const params = new URLSearchParams({
      data_inicio: dateRange.from.toLocaleDateString('pt-BR'),
      data_final: dateRange.to.toLocaleDateString('pt-BR'),
      tipo,
      natureza: natureza || 'pf'
    })
    const res = await fetch(
      `${API_BASE_URL}/dashboard/gastos-por-categoria?${params}`
    )
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao buscar gastos por categoria`)
    }
    return res.json()
  }

  // 4. Entradas por categoria (agora opcional natureza)
  static async getCategoryIncome(
    dateRange: { from: Date; to: Date },
    natureza?: 'pf' | 'pj' | 'all'
  ): Promise<CategoryBreakdown> {
    const params = new URLSearchParams({
      data_inicio: dateRange.from.toLocaleDateString('pt-BR'),
      data_final: dateRange.to.toLocaleDateString('pt-BR'),
      natureza: natureza || 'pf'
    });
    const res = await fetch(
      `${API_BASE_URL}/dashboard/entradas-por-categoria?${params}`
    );
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao buscar entradas por categoria`);
    }
    return res.json();
  }

  // 5. Mapa de categoria → subcategorias (opcional natureza e tipo)
  static async getCategorySubcategories(
    natureza?: 'pf' | 'pj' | 'all',
    tipo?: string
  ): Promise<CategorySubcategories> {
    const params = new URLSearchParams()
    if (natureza) params.set('natureza', natureza)
    if (tipo) params.set('tipo', tipo)
    const query = params.toString() ? `?${params.toString()}` : ''
    const res = await fetch(`${API_BASE_URL}/dashboard/opcoes-categorias${query}`)
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao buscar categorias`)
    }
    return res.json()
  }

  // 6. Todas as transações (opcional natureza)
  static async getAllTransactions(
    natureza?: 'pf' | 'pj'
  ): Promise<Transaction[]> {
    const query = natureza ? `?natureza=${natureza}` : '';
    const res = await fetch(`${API_BASE_URL}/transacoes${query}`);
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao listar transações`);
    }
    return res.json();
  }

  // 7. Transações por mês (agora com filtro de natureza)
  static async getTransactionsByMonth(
    year: number,
    month: number,
    natureza?: 'pf' | 'pj'
  ): Promise<Transaction[]> {
    const params = new URLSearchParams({
      ano: year.toString(),
      mes: month.toString(),
      ...(natureza ? { natureza } : {})
    });
    const res = await fetch(
      `${API_BASE_URL}/dashboard/transacoes-por-mes?${params}`
    );
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao buscar transações por mês`);
    }
    return res.json();
  }

  // 7b. Transacoes do ano inteiro (para o grafico anual)
  static async getYearTransactions(
    year: number,
    natureza?: string
  ): Promise<Transaction[]> {
    const from = new Date(year, 0, 1);
    const to = new Date(year, 11, 31);
    const params = new URLSearchParams({
      data_inicio: from.toLocaleDateString('pt-BR'),
      data_final: to.toLocaleDateString('pt-BR'),
      ...(natureza && natureza !== 'all' ? { natureza } : {}),
    });
    const res = await fetch(`${API_BASE_URL}/transacoes/?${params}`);
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao buscar transacoes do ano`);
    }
    return res.json();
  }

  // 8. Verificar duplicatas (single ou bulk)
  static async checkDuplicates(
    params: { data_transacao?: string; valor?: number; transacoes?: Array<{ index: number; data_transacao: string; valor: number }> }
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

  // 8b. Resolver duplicatas (Pluggy pós-sync)
  static async resolveDuplicates(
    resolutions: DuplicateResolution[]
  ): Promise<ResolveDuplicatesResponse> {
    const res = await fetch(`${API_BASE_URL}/transacoes/resolve-duplicates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolutions }),
    });
    if (!res.ok) {
      throw new Error(`Erro ${res.status} ao resolver duplicatas`);
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
    const res = await fetch(`${API_BASE_URL}/categorias/`);
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


