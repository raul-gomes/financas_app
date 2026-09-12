export interface TotaisOverview {
  total_income: number;
  total_expenses: number;
  total_invested: number;
  balance: number;
}

export interface MonthProgressOverview {
  day: number;
  days_in_month: number;
  percent: number;
  income_up_to_today: number;
  expenses_up_to_today: number;
  balance: number;
}

export interface CreditCardOverview {
  limit: number;
  used: number;
  remaining: number;
  percent_used: number;
}

export interface CategoriaStatusOverview {
  id: number;
  category_name: string;
  entity_type: 'individual' | 'business';
  limit: number;
  spent: number;
  remaining: number;
  percent_used: number;
  status: 'ok' | 'warning' | 'over';
}

export interface ParcelaMesOverview {
  id: number;
  description: string;
  amount: number;
  installment_number: number | null;
  total_installments: number | null;
  category_name: string;
  subcategory_name: string;
  payment_method: string;
  entity_type: 'individual' | 'business';
  transaction_date: string;
}

export interface RecorrentePagarOverview {
  id: number;
  description: string;
  amount: number;
  due_day: number;
  category_name: string;
  subcategory_name: string;
  entity_type: 'individual' | 'business';
  payment_method: string;
  current_installment: number;
  total_installments: number;
  remaining_installments: number;
  is_ending_soon: boolean;
}

export interface MetaOverviewItem {
  subcategory_id: number;
  subcategory_name: string;
  target_amount: number;
  current_amount: number;
  progress: number;
  completed: boolean;
  completed_at: string | null;
  entity_type: 'individual' | 'business';
}

export interface CompraOverviewItem {
  id: number;
  name: string;
  reference_month: string;
  checked: boolean;
  completed_at: string | null;
  entity_type: 'individual' | 'business';
}

export interface OverviewResponse {
  reference_month: string;
  entity_type: 'individual' | 'business' | 'all';
  totals: TotaisOverview;
  month_progress: MonthProgressOverview;
  credit_card: CreditCardOverview;
  categories_status: CategoriaStatusOverview[];
  installments: ParcelaMesOverview[];
  recurring_accounts: RecorrentePagarOverview[];
  goals: MetaOverviewItem[];
  shopping: CompraOverviewItem[];
}