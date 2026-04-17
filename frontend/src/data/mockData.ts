import { Transaction, Investment, PortfolioEvolution, CategoryExpense, YearlyData } from '@/types/financial';

// Mock data temporário para desenvolvimento
export const mockTransactions: Transaction[] = [
  {
    id: 1,
    tipo: 'entrada',
    valor: 2500.00,
    descricao: 'Desenvolvimento Sistema',
    categoria_id: 1,
    subcategoria_id: 1,
    categoria_nome: 'Prestação de Serviços',
    subcategoria_nome: 'Desenvolvimento Sistema',
    forma_pagamento: 'pix',
    parcela: null,
    total_parcelas: null,
    natureza: 'pj',
    data_transacao: '2025-01-05'
  },
  {
    id: 2,
    tipo: 'saida',
    valor: 450.00,
    descricao: 'Google Ads',
    categoria_id: 2,
    subcategoria_id: 2,
    categoria_nome: 'Marketing',
    subcategoria_nome: 'Google Ads',
    forma_pagamento: 'credito',
    parcela: 1,
    total_parcelas: 1,
    natureza: 'pj',
    data_transacao: '2025-01-03'
  }
];

export const mockYearlyData: YearlyData[] = [
  { month: 'Jan', income: 5000, expenses: 2000, profit: 3000 },
  { month: 'Fev', income: 5500, expenses: 2200, profit: 3300 },
  { month: 'Mar', income: 6000, expenses: 2500, profit: 3500 },
  { month: 'Abr', income: 5800, expenses: 2300, profit: 3500 },
  { month: 'Mai', income: 6200, expenses: 2600, profit: 3600 },
  { month: 'Jun', income: 6500, expenses: 2800, profit: 3700 }
];

export const mockCategoryExpenses: CategoryExpense[] = [
  { category: 'Marketing', amount: 1200, percentage: 30, color: '#8b5cf6' },
  { category: 'Equipamentos', amount: 800, percentage: 20, color: '#3b82f6' },
  { category: 'Impostos', amount: 600, percentage: 15, color: '#f97316' },
  { category: 'Aluguel Comercial', amount: 1000, percentage: 25, color: '#eab308' },
  { category: 'Prestação de Serviços', amount: 400, percentage: 10, color: '#22c55e' }
];

export const mockInvestments: Investment[] = [
  {
    id: '1',
    name: 'PETR4',
    type: 'variavel',
    category: 'Ações',
    quantity: 100,
    currentPrice: 35.50,
    totalValue: 3550,
    profit: 550,
    profitPercentage: 18.3
  },
  {
    id: '2',
    name: 'VALE3',
    type: 'variavel',
    category: 'Ações',
    quantity: 50,
    currentPrice: 68.20,
    totalValue: 3410,
    profit: 410,
    profitPercentage: 13.7
  }
];

export const mockPortfolioEvolution: PortfolioEvolution[] = [
  { date: '2024-01', value: 10000 },
  { date: '2024-02', value: 10500 },
  { date: '2024-03', value: 11200 },
  { date: '2024-04', value: 10800 },
  { date: '2024-05', value: 11500 },
  { date: '2024-06', value: 12000 }
];