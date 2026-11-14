import type { z } from 'zod';
import type { metaSchema, metaProgressoSchema } from '@/schemas/goals';

export type Meta = z.infer<typeof metaSchema>;
export type MetaProgresso = z.infer<typeof metaProgressoSchema>;

export interface MetaCreate {
  subcategory_name: string;
  target_amount: number;
  entity_type?: string;
}

export interface MetaUpdate {
  subcategory_name?: string;
  target_amount?: number;
}

