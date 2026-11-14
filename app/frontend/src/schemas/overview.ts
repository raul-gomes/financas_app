import { z } from 'zod';

const scopeSchema = z.enum(['individual', 'business']);

/** `OverviewResponse` (app/backend/app/schemas/overview.py). */
export const overviewResponseSchema = z.object({
  reference_month: z.string(),
  entity_type: z.enum(['individual', 'business', 'all']),
  totals: z.object({
    total_income: z.number(),
    total_expenses: z.number(),
    total_invested: z.number(),
    balance: z.number(),
  }),
  month_progress: z.object({
    day: z.number(),
    days_in_month: z.number(),
    percent: z.number(),
    income_up_to_today: z.number(),
    expenses_up_to_today: z.number(),
    balance: z.number(),
  }),
  credit_card: z.object({
    limit: z.number(),
    used: z.number(),
    remaining: z.number(),
    percent_used: z.number(),
  }),
  categories_status: z.array(
    z.object({
      id: z.number(),
      category_name: z.string(),
      entity_type: scopeSchema,
      limit: z.number(),
      spent: z.number(),
      remaining: z.number(),
      percent_used: z.number(),
      status: z.enum(['ok', 'warning', 'over']),
    }),
  ),
  installments: z.array(
    z.object({
      id: z.number(),
      description: z.string(),
      amount: z.number(),
      installment_number: z.number().nullable(),
      total_installments: z.number().nullable(),
      category_name: z.string(),
      subcategory_name: z.string(),
      payment_method: z.string(),
      entity_type: scopeSchema,
      transaction_date: z.string(),
    }),
  ),
  recurring_accounts: z.array(
    z.object({
      id: z.number(),
      description: z.string(),
      amount: z.number(),
      due_day: z.number(),
      category_name: z.string(),
      subcategory_name: z.string(),
      entity_type: scopeSchema,
      payment_method: z.string(),
      current_installment: z.number(),
      total_installments: z.number(),
      remaining_installments: z.number(),
      is_ending_soon: z.boolean(),
    }),
  ),
  goals: z.array(
    z.object({
      subcategory_id: z.number(),
      subcategory_name: z.string(),
      target_amount: z.number(),
      current_amount: z.number(),
      progress: z.number(),
      completed: z.boolean(),
      completed_at: z.string().nullable(),
      entity_type: scopeSchema,
    }),
  ),
  shopping: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      reference_month: z.string(),
      checked: z.boolean(),
      completed_at: z.string().nullable(),
      entity_type: scopeSchema,
    }),
  ),
});
