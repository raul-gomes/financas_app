import { z } from 'zod';

/** Mirrors `TipoTransacao` in app/backend/app/schemas/transaction.py. */
export const transactionTypeSchema = z.enum(['income', 'expense', 'investment']);

/** Mirrors `NaturezaTransacao`. */
export const entityTypeSchema = z.enum(['individual', 'business']);

/** `TransacaoResponse` / `TransacaoExtrato`. Pydantic floats arrive as JSON numbers. */
export const transactionSchema = z.object({
  id: z.number(),
  type: transactionTypeSchema,
  amount: z.number(),
  description: z.string(),
  category_id: z.number(),
  subcategory_id: z.number(),
  category_name: z.string().nullish(),
  subcategory_name: z.string().nullish(),
  payment_method: z.string(),
  installment_number: z.number().nullable(),
  total_installments: z.number().nullable(),
  is_installment: z.boolean(),
  bank_code: z.string().nullish(),
  entity_type: entityTypeSchema,
  transaction_date: z.string(),
  recurring_account_id: z.number().nullish(),
});

/** `TransacaoResponse[]` from `GET /transacoes/`. */
export const transactionListSchema = z.array(transactionSchema);

/** `ExtratoResponse`. */
export const financialSummarySchema = z.object({
  total_income: z.number(),
  total_expenses: z.number(),
  start_date: z.string(),
  end_date: z.string(),
  monthly_goal: z.number(),
  total_invested: z.number(),
  transactions: z.array(transactionSchema),
  credit_card_limit: z.number(),
  fixed_expenses: z.number(),
  variable_expenses: z.number(),
});

/** `RendimentoPeriodoResponse`. */
export const yearlyPerformanceSchema = z.object({
  limit: z.number(),
  months: z.record(z.object({ income: z.number(), expense: z.number() })),
});

/** `GastosPorCategoriaResponse`. Subcategory amount is a string in the API. */
export const categoryBreakdownSchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  categories: z.array(
    z.object({
      name: z.string(),
      total: z.number(),
      limit: z.number(),
      subcategories: z.array(z.object({ name: z.string(), amount: z.string() })),
    }),
  ),
});

/** `EntradasPorCategoriaResponse`. */
export const incomeBySubcategorySchema = z.object({
  start_date: z.string(),
  end_date: z.string(),
  subcategories: z.array(z.object({ name: z.string(), total: z.number() })),
});

/** `OpcoesCategoriaResponse`. */
export const categorySubcategoriesSchema = z.object({
  options: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      type: z.string().nullish(),
      subcategories: z.array(z.object({ id: z.number(), name: z.string() })),
    }),
  ),
});

/** `DuplicateCheckResponse`. */
export const duplicateCheckResponseSchema = z.object({
  results: z.array(
    z.object({
      index: z.number(),
      has_duplicate: z.boolean(),
      duplicates: z.array(
        z.object({
          id: z.number(),
          description: z.string(),
          amount: z.number(),
          transaction_date: z.string(),
          type: z.string(),
          entity_type: z.string(),
          category_name: z.string().nullish(),
          subcategory_name: z.string().nullish(),
          payment_method: z.string().nullish(),
          created_at: z.string().nullish(),
        }),
      ),
    }),
  ),
});

/** Entity scopes stored on categories; "mensal" is a legacy value for monthly caps. */
const limitEntitySchema = z.enum(['individual', 'business', 'all', 'mensal']);

/** `GET /categories/` (`Categoria`). */
export const limitsPayloadSchema = z.array(
  z.object({
    id: z.number(),
    category_name: z.string(),
    entity_type: limitEntitySchema,
    limit: z.number(),
    type: transactionTypeSchema.nullish(),
    subcategories: z.array(
      z.object({
        id: z.number(),
        subcategory_name: z.string(),
        target_amount: z.number().nullish(),
      }),
    ),
  }),
);

/** `LimitsUpdateResponse`. */
export const limitsUpdateResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  created_categories: z.number(),
  updated_categories: z.number(),
  deleted_categories: z.number(),
  created_subcategories: z.number(),
  updated_subcategories: z.number(),
  errors: z.array(z.string()),
});

/** `LimitsWithSpendingResponse`. */
export const limitsWithSpendingSchema = z.object({
  month: z.string(),
  categories: z.array(
    z.object({
      id: z.number(),
      category_name: z.string(),
      entity_type: limitEntitySchema,
      limit: z.number(),
      spent: z.number(),
      remaining: z.number(),
      percent_used: z.number(),
      subcategories: z.array(
        z.object({
          id: z.number(),
          subcategory_name: z.string(),
          spent: z.number(),
          limit: z.number().nullish(),
        }),
      ),
    }),
  ),
  total_limit: z.number(),
  total_spent: z.number(),
  total_remaining: z.number(),
});
