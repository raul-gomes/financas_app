// ============= Tipos baseados nos novos payloads =============

// Interfaces de categorias e subcategorias
export interface SubcategoriaOpcao {
  id: number
  name: string
}

export interface CategoriaOpcao {
  id: number
  name: string
  type?: string | null
  subcategories: SubcategoriaOpcao[]
}

export interface CategorySubcategories {
  options: CategoriaOpcao[]
}

export interface Transaction {
  id: number;
  type: 'income' | 'expense' | 'investment';
  amount: number;
  description: string;
  category_id: number;
  subcategory_id: number;
  category_name: string;
  subcategory_name: string;
  payment_method: string;  // Any string — custom values via "Outros" allowed
  installment_number: number | null;
  total_installments: number | null;
  is_installment: boolean;
  bank_code: string | null;
  entity_type: 'business' | 'individual';
  transaction_date: string;
  recurring_account_id?: number | null;
}

export interface FinancialSummary {
  total_income: number;
  total_expenses: number;
  start_date: string;
  end_date: string;
  monthly_goal: number;
  total_invested: number;
  transactions: Transaction[];
  credit_card_limit: number;
  fixed_expenses: number;
  variable_expenses: number;
}

export interface MonthData {
  income: number;
  expense: number;
}

export interface YearlyPerformance {
  limit: number;
  months: Record<string, MonthData>;
}

export interface CategoryPeriodData {
  start_date: string;   // "DD/MM/YYYY"
  end_date: string;     // "DD/MM/YYYY" 
  subcategories: Array<{
    total: number;
    limit: number;
    [category: string]: any; // permite propriedades dinâmicas das categorias
  }>;
}

//Interfaes de categorias
export interface SubcategoriaGasto {
  name: string
  amount: string
}

export interface CategoriaGasto {
  name: string
  total: number
  limit: number
  subcategories: SubcategoriaGasto[]
}

/** @deprecated Use CategoriaGasto instead */
export type CategoriaGastoOld = CategoriaGasto;

export interface CategoryBreakdown {
  start_date: string
  end_date: string
  categories: CategoriaGasto[]
}

export interface IncomeSubcategoriaItem {
  name: string;
  total: number;
}

export interface IncomeBySubcategoria {
  start_date: string;
  end_date: string;
  subcategories: IncomeSubcategoriaItem[];
}

export interface CategoryExpense {
  category: string;
  amount: number;
  percentage: number;
  color: string;
  subcategories?: Record<string, number>;
}

// Tipos para componentes internos
export interface MonthlyBalance {
  income: number;
  expenses: number;
  balance: number;
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
  name: string
}

export interface Category {
  id: number
  name: string
  entity_type: 'individual' | 'business' | 'all'
  limit: number
  subcategories: Subcategory[]
}

export type LimitsPayload = Category[]

export interface CategoriaLimiteUpdate {
  id?: number
  name: string
  entity_type: 'individual' | 'business' | 'all'
  limit: number
  subcategories: {
    id?: number
    name: string
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
  deleted_categories: number
  created_subcategories: number
  updated_subcategories: number
  errors: string[]
}

// ===== Duplicate Checking Types =====

export interface DuplicateInfo {
  id: number;
  description: string;
  amount: number;
  transaction_date: string;
  type: string;
  entity_type: string;
  category_name?: string | null;
  subcategory_name?: string | null;
  payment_method?: string | null;
  created_at?: string | null;
}

export interface SingleDuplicateCheckResult {
  index: number;
  has_duplicate: boolean;
  duplicates: DuplicateInfo[];
}

export interface DuplicateCheckResponse {
  results: SingleDuplicateCheckResult[];
}

export type DuplicateAction = 'keep' | 'replace' | 'edit';

export interface DuplicateResolution {
  new_id: number;
  existing_id: number;
  action: 'keep_both' | 'keep_new' | 'keep_existing';
}

export interface ResolveDuplicatesResponse {
  resolved: number;
  deleted: number;
  kept: number;
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
