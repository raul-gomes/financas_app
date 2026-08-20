export interface ContaRecorrente {
  id: number;
  description: string;
  amount: number;
  due_day: number;
  category_id: number;
  subcategory_id: number;
  category_name?: string;
  subcategory_name?: string;
  entity_type: 'individual' | 'business';
  payment_method: string;
  bank_code?: string;
  start_date: string;
  end_date?: string;
  active: boolean;
  group_id: string;
  total_installments: number;
  remaining_installments: number;
}

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

export interface GenerateResponse {
  generated: number;
  details: string[];
}
