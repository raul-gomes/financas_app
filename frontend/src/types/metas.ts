export interface Meta {
  id: number;
  subcategoria_nome: string;
  valor_alvo: number;
  categoria_id: number;
  concluida: boolean;
  data_conclusao: string | null;
}

export interface MetaCreate {
  subcategoria_nome: string;
  valor_alvo: number;
}

export interface MetaUpdate {
  subcategoria_nome?: string;
  valor_alvo?: number;
}

export interface MetaProgresso {
  subcategoria_id: number;
  subcategoria_nome: string;
  valor_alvo: number;
  valor_atual: number;
  progresso: number;
  concluida: boolean;
  data_conclusao: string | null;
}
