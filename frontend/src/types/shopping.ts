export interface ShoppingItem {
  id: number;
  nome: string;
  mes_ref: string;
  marcado: boolean;
  data_conclusao: string | null;
  created_at?: string;
}

export interface ShoppingItemCreate {
  nome: string;
  mes_ref: string;
}

export interface ShoppingItemUpdate {
  nome?: string;
  marcado?: boolean;
}
