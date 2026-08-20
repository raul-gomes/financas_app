export interface ParsedTransaction {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category_id?: number;
  subcategory_id?: number;
  payment_method: string;
  entity_type: string;
}

export interface UploadResponse {
  total: number;
  total_income: number;
  total_expenses: number;
  total_income_amount: number;
  total_expenses_amount: number;
  transactions: ParsedTransaction[];
}

export interface ConfirmTransaction {
  date: string;
  description: string;
  amount: number;
  type: string;
  category_id?: number;
  subcategory_id?: number;
  category_name?: string;
  subcategory_name?: string;
  payment_method: string;
  entity_type: string;
  bank_code?: string;
  total_installments?: number;
  is_installment?: boolean;
}

export interface ConfirmPayload {
  transactions: ConfirmTransaction[];
}

export interface ConfirmResponse {
  created: number;
  errors: string[];
}

export interface SessionData {
  filename: string;
  bankCode: string;
  isConfirmed: boolean;
  transactions: ParsedTransaction[];
}
