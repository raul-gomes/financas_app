import type { z } from 'zod';
import type { shoppingItemSchema } from '@/schemas/shopping';

export type ShoppingItem = z.infer<typeof shoppingItemSchema>;

export interface ShoppingItemCreate {
  name: string;
  reference_month: string;
  entity_type?: string;
}

export interface ShoppingItemUpdate {
  name?: string;
  checked?: boolean;
  entity_type?: string;
}
