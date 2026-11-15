import { z } from 'zod';

/** `ContaRecorrenteResponse`. */
export const contaRecorrenteSchema = z.object({
  id: z.number(),
  description: z.string(),
  amount: z.number(),
  due_day: z.number(),
  category_id: z.number(),
  subcategory_id: z.number(),
  category_name: z.string().nullish(),
  subcategory_name: z.string().nullish(),
  entity_type: z.enum(['individual', 'business']),
  payment_method: z.string(),
  bank_code: z.string().nullish(),
  start_date: z.string(),
  end_date: z.string().nullish(),
  active: z.boolean(),
  total_installments: z.number(),
  remaining_installments: z.number(),
  current_installment: z.number(),
  is_ending_soon: z.boolean(),
  can_renew: z.boolean(),
});

export const contaRecorrenteListSchema = z.array(contaRecorrenteSchema);
