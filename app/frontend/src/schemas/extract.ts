import { z } from 'zod';

/** `ParsedTransaction`. Category ids, payment method and entity are optional in the API. */
export const parsedTransactionSchema = z.object({
  date: z.string(),
  description: z.string(),
  amount: z.number(),
  type: z.enum(['income', 'expense']),
  category_id: z.number().nullish(),
  subcategory_id: z.number().nullish(),
  payment_method: z.string().nullish(),
  entity_type: z.string().nullish(),
});

/** `UploadResponse`. */
export const uploadResponseSchema = z.object({
  total: z.number(),
  total_income: z.number(),
  total_expenses: z.number(),
  total_income_amount: z.number(),
  total_expenses_amount: z.number(),
  transactions: z.array(parsedTransactionSchema),
});

/** `ConfirmResponse`. */
export const confirmResponseSchema = z.object({
  created: z.number(),
  errors: z.array(z.string()),
});
