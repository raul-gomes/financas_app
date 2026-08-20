export interface Meta {
  id: number;
  subcategory_name: string;
  target_amount: number;
  category_id: number;
  completed: boolean;
  completed_at: string | null;
}

export interface MetaCreate {
  subcategory_name: string;
  target_amount: number;
  entity_type?: string;
}

export interface MetaUpdate {
  subcategory_name?: string;
  target_amount?: number;
}

export interface MetaProgresso {
  subcategory_id: number;
  subcategory_name: string;
  target_amount: number;
  current_amount: number;
  progress: number;
  completed: boolean;
  completed_at: string | null;
  entity_type: string;
}
