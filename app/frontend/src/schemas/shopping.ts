import { z } from 'zod';

/** `ShoppingItemResponse`. */
export const shoppingItemSchema = z.object({
  id: z.number(),
  name: z.string(),
  reference_month: z.string(),
  checked: z.boolean(),
  completed_at: z.string().nullable(),
  created_at: z.string().nullish(),
  entity_type: z.string(),
  is_recurring: z.boolean(),
  recurrence_group_id: z.string().nullable(),
  recurrence_end_date: z.string().nullable(),
});

export const shoppingItemListSchema = z.array(shoppingItemSchema);
