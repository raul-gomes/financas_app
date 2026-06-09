// ============= Tipos baseados nos novos payloads =============

// Interfaces de categorias e subcategorias
export interface SubcategoriaOpcao {
  id: number
  nome: string
}

export interface CategoriaOpcao {
  id: number
  categoria: string
  tipo?: string | null
  subcategorias: SubcategoriaOpcao[]
}

export interface CategorySubcategories {
  opcoes: CategoriaOpcao[]
}

export interface Transaction {
  id: number;
  tipo: 'entrada' | 'saida' | 'investimento';
  valor: number;
  descricao: string;
  categoria_id: number;
  subcategoria_id: number;
  categoria_nome: string;
  subcategoria_nome: string;
  forma_pagamento: 'credito' | 'debito' | 'pix' | 'transferencia' | 'dinheiro' | 'boleto';
  parcela: number | null;
  total_parcelas: number | null;
  natureza: 'pj' | 'pf';
  data_transacao: string;
  conta_recorrente_id?: number | null;
}

export interface FinancialSummary {
  entradas: number;
  saidas: number;
  data_inicial: string;
  data_final: string;
  meta_mensal: number;
  total_investido: number;
  transacoes: Transaction[];
  limite_cartao_credito: number;
  gastos_fixos: number;
  gastos_variaveis: number;
}

export interface MonthData {
  entrada: number;
  saida: number;
}

export interface YearlyPerformance {
  limite: number;
  meses: Record<string, MonthData>;
}

export interface CategoryPeriodData {
  data_inicial: string;   // "DD/MM/YYYY"
  data_final: string;     // "DD/MM/YYYY" 
  subcategorias: Array<{
    total: number;
    limite: number;
    [category: string]: any; // permite propriedades dinâmicas das categorias
  }>;
}

//Interfaes de categorias
export interface SubcategoriaGasto {
  nome: string
  valor: string
}

export interface CategoriaGasto {
  nome: string
  total: number
  limite: number
  subcategorias: SubcategoriaGasto[]
}

export interface CategoryBreakdown {
  data_inicial: string
  data_final: string
  categorias: CategoriaGasto[]
}

export interface CategoryExpense {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  subcategories?: Record<string, number>;
}

interface IncomeChartProps {
  breakdown: CategoryBreakdown | null
  dateRange: { from: Date; to: Date }
}


// Tipos para componentes internos
export interface MonthlyBalance {
  income: number;
  expenses: number;
  balance: number;
}

export interface CategoryExpense {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  subcategories?: Record<string, number>;
}

export interface YearlyData {
  month: string;
  income: number;
  expenses: number;
  profit: number;
  investment: number;
}

// Daily breakdown for flip chart
export interface DailyData {
  day: number;
  income: number;
  expenses: number;
  investment: number;
}

export interface SelectedMonth {
  name: string;
  index: number;
  year: number;
}

// Tipos de componentes limites

export interface Subcategory {
  id: number
  subcategoria_nome: string
}

export interface Category {
  id: number
  categoria_nome: string
  natureza: 'pf' | 'pj' | 'all'
  limite: number
  subcategorias: Subcategory[]
}

export type LimitsPayload = Category[]

export interface CategoriaLimiteUpdate {
  id?: number
  categoria_nome: string
  natureza: 'pf' | 'pj' | 'all'
  limite: number
  subcategorias: {
    id?: number
    subcategoria_nome: string
  }[]
}

export interface LimitsUpdatePayload {
  new: CategoriaLimiteUpdate[]
  modified: CategoriaLimiteUpdate[]
}

export interface LimitsUpdateResponse {
  success: boolean
  message: string
  created_categories: number
  updated_categories: number
  created_subcategories: number
  updated_subcategories: number
  errors: string[]
}

// Categorias baseadas no payload
export const CATEGORY_SUBCATEGORIES = {
  "Prestação de Serviços": [
    "Desenvolvimento Sistema",
    "Consultoria TI",
    "Manutenção Software",
    "Treinamento Equipe"
  ],
  "Equipamentos": [
    "Notebook Dell",
    "Monitor Samsung",
    "Licenças Software",
    "Servidor AWS"
  ],
  "Marketing": [
    "Google Ads",
    "Facebook Ads",
    "Design Gráfico",
    "Site Institucional"
  ],
  "Impostos": [
    "DAS MEI",
    "ISS Municipal",
    "IRPJ Trimestral"
  ],
  "Aluguel Comercial": [
    "Aluguel Escritório",
    "Condomínio Comercial",
    "IPTU Comercial"
  ]
};

export const CATEGORIES = Object.keys(CATEGORY_SUBCATEGORIES);

export const CATEGORY_COLORS: Record<string, string> = {
  'Prestação de Serviços': '#22c55e',
  'Equipamentos': '#3b82f6',
  'Marketing': '#8b5cf6',
  'Impostos': '#f97316',
  'Aluguel Comercial': '#eab308'
};

// Investment types (mantidos iguais)
export interface Investment {
  id: string;
  name: string;
  type: 'variavel' | 'fixa';
  category: string;
  quantity: number;
  currentPrice: number;
  totalValue: number;
  profit: number;
  profitPercentage: number;
}

export interface PortfolioEvolution {
  date: string;
  value: number;
}

export const INVESTMENT_CATEGORIES = {
  variavel: ['Ações', 'FIIs', 'ETFs', 'Criptomoedas'],
  fixa: ['CDB', 'LCI', 'LCA', 'Tesouro Direto', 'Debêntures']
} as const;