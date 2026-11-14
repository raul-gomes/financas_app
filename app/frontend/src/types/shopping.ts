import type { Infer } from '@/lib/parse';
import type { shoppingItemSchema } from '@/schemas/shopping';

export type ShoppingItem = Infer<typeof shoppingItemSchema>;

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
