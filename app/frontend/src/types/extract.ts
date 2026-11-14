import type { Infer } from '@/lib/parse';
import type { uploadResponseSchema, confirmResponseSchema } from '@/schemas/extract';

/** Raw upload response; `SessionData` holds the normalised transactions. */
export type UploadResponse = Infer<typeof uploadResponseSchema>;
export type ConfirmResponse = Infer<typeof confirmResponseSchema>;

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

export interface SessionData {
  filename: string;
  bankCode: string;
  isConfirmed: boolean;
  transactions: ParsedTransaction[];
}
