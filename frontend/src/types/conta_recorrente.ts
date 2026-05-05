export interface ContaRecorrente {
  id: number;
  descricao: string;
  valor: number;
  dia_vencimento: number;
  categoria_id: number;
  subcategoria_id: number;
  categoria_nome?: string;
  subcategoria_nome?: string;
  natureza: 'pf' | 'pj';
  forma_pagamento: string;
  data_inicio: string;
  data_fim?: string;
  ativo: boolean;
  group_id: string;
}

export interface ContaRecorrenteCreate {
  descricao: string;
  valor: number;
  dia_vencimento: number;
  categoria_id: number;
  subcategoria_id: number;
  natureza: 'pf' | 'pj';
  forma_pagamento: string;
  data_inicio: string;
  data_fim?: string;
  ativo?: boolean;
}

export interface ContaRecorrenteUpdate {
  descricao?: string;
  valor?: number;
  dia_vencimento?: number;
  categoria_id?: number;
  subcategoria_id?: number;
  natureza?: 'pf' | 'pj';
  forma_pagamento?: string;
  data_inicio?: string;
  data_fim?: string;
  ativo?: boolean;
}

export interface GenerateResponse {
  geradas: number;
  detalhes: string[];
}
