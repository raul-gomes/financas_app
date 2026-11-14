import type { Infer } from '@/lib/parse';
import type { metaSchema, metaProgressoSchema } from '@/schemas/goals';

export type Meta = Infer<typeof metaSchema>;
export type MetaProgresso = Infer<typeof metaProgressoSchema>;

export interface MetaCreate {
  subcategory_name: string;
  target_amount: number;
  entity_type?: string;
}

export interface MetaUpdate {
  subcategory_name?: string;
  target_amount?: number;
}

