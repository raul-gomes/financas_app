import type { Infer } from '@/lib/parse';
import type { contaRecorrenteSchema, generateResponseSchema } from '@/schemas/recurringAccount';

export type ContaRecorrente = Infer<typeof contaRecorrenteSchema>;
export type GenerateResponse = Infer<typeof generateResponseSchema>;

export interface ContaRecorrenteCreate {
  description: string;
  amount: number;
  due_day: number;
  category_id?: number;
  subcategory_id?: number;
  category_name?: string;
  subcategory_name?: string;
  entity_type: 'individual' | 'business';
  payment_method: string;
  bank_code?: string;
  start_date: string;
  end_date?: string;
  active?: boolean;
  total_installments?: number;
}

export interface ContaRecorrenteUpdate {
  description?: string;
  amount?: number;
  due_day?: number;
  category_id?: number;
  subcategory_id?: number;
  category_name?: string;
  subcategory_name?: string;
  entity_type?: 'individual' | 'business';
  payment_method?: string;
  bank_code?: string;
  start_date?: string;
  end_date?: string;
  active?: boolean;
}

