import type { z } from 'zod';
import type {
  transactionSchema, transactionPageSchema, financialSummarySchema, yearlyPerformanceSchema,
  categoryBreakdownSchema, incomeBySubcategorySchema, categorySubcategoriesSchema,
  limitsUpdateResponseSchema, limitsWithSpendingSchema, duplicateCheckResponseSchema,
  limitsPayloadSchema,
} from '@/schemas/financial';

// ============= Tipos baseados nos novos payloads =============

// Interfaces de categorias e subcategorias

/** Body sent when creating a transaction (category given by id or by name). */
export type TransactionCreatePayload = Partial<Omit<Transaction, 'id'>>;

export interface MonthData {
  income: number;
  expense: number;
}

export interface CategoryPeriodData {
  start_date: string;   // "DD/MM/YYYY"
  end_date: string;     // "DD/MM/YYYY" 
  subcategories: Array<{
    total: number;
    limit: number;
    [category: string]: number;
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

export interface IncomeSubcategoriaItem {
  name: string;
  total: number;
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

// ===== Duplicate Checking Types =====

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

// ===== API response types, derived from the Zod schemas in src/schemas/financial.ts =====
export type Transaction = z.infer<typeof transactionSchema>;
export type TransactionPage = z.infer<typeof transactionPageSchema>;
export type FinancialSummary = z.infer<typeof financialSummarySchema>;
export type YearlyPerformance = z.infer<typeof yearlyPerformanceSchema>;
export type CategoryBreakdown = z.infer<typeof categoryBreakdownSchema>;
export type IncomeBySubcategoria = z.infer<typeof incomeBySubcategorySchema>;
export type CategorySubcategories = z.infer<typeof categorySubcategoriesSchema>;
export type CategoriaOpcao = CategorySubcategories['options'][number];
export type SubcategoriaOpcao = CategoriaOpcao['subcategories'][number];
export type LimitsUpdateResponse = z.infer<typeof limitsUpdateResponseSchema>;
export type LimitsWithSpending = z.infer<typeof limitsWithSpendingSchema>;
export type LimitsCategorySpending = LimitsWithSpending['categories'][number];
export type DuplicateCheckResponse = z.infer<typeof duplicateCheckResponseSchema>;
export type SingleDuplicateCheckResult = DuplicateCheckResponse['results'][number];
export type DuplicateInfo = SingleDuplicateCheckResult['duplicates'][number];
/** Raw `GET /categories/` payload (names come as `category_name` / `subcategory_name`). */
export type LimitsPayload = z.infer<typeof limitsPayloadSchema>;
