export interface ParsedTransaction {
  data: string;
  descricao: string;
  valor: number;
  tipo: 'entrada' | 'saida';
  categoria_id?: number;
  subcategoria_id?: number;
  forma_pagamento: string;
  natureza: string;
}

export interface UploadResponse {
  total: number;
  entradas: number;
  saidas: number;
  total_entradas: number;
  total_saidas: number;
  transacoes: ParsedTransaction[];
}

export interface ConfirmTransaction {
  data: string;
  descricao: string;
  valor: number;
  tipo: string;
  categoria_id?: number;
  subcategoria_id?: number;
  categoria_nome?: string;
  subcategoria_nome?: string;
  forma_pagamento: string;
  natureza: string;
  bank_code?: string;
  total_parcelas?: number;
}

export interface ConfirmPayload {
  transacoes: ConfirmTransaction[];
}

export interface ConfirmResponse {
  criadas: number;
  erros: string[];
}

export interface SessionData {
  filename: string;
  bankCode: string;
  isConfirmed: boolean;
  transactions: ParsedTransaction[];
}
