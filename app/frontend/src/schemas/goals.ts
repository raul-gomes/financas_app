import { z } from 'zod';

/** `MetaResponse`. */
export const metaSchema = z.object({
  id: z.number(),
  subcategory_name: z.string(),
  target_amount: z.number(),
  category_id: z.number(),
  completed: z.boolean(),
  completed_at: z.string().nullable(),
});

export const metaListSchema = z.array(metaSchema);

/** `MetaProgresso`. */
export const metaProgressoSchema = z.object({
  subcategory_id: z.number(),
  subcategory_name: z.string(),
  target_amount: z.number(),
  current_amount: z.number(),
  progress: z.number(),
  completed: z.boolean(),
  completed_at: z.string().nullable(),
  entity_type: z.string(),
});

export const metaProgressoListSchema = z.array(metaProgressoSchema);
