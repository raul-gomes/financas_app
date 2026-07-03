export interface ShoppingItem {
  id: number;
  name: string;
  reference_month: string;
  checked: boolean;
  completed_at: string | null;
  created_at?: string;
  entity_type: string;
}

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
