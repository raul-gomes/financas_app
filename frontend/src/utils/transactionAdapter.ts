import { Transaction } from '@/types/financial';

// Adaptador para converter dados da API para formato interno
export const adaptTransactionFromApi = (apiTransaction: any): Transaction => {
  return {
    id: apiTransaction.id,
    tipo: apiTransaction.tipo,
    valor: apiTransaction.valor,
    descricao: apiTransaction.descricao,
    categoria_id: apiTransaction.categoria_id,
    subcategoria_id: apiTransaction.subcategoria_id,
    categoria_nome: apiTransaction.categoria_nome || 'Sem Categoria',
    subcategoria_nome: apiTransaction.subcategoria_nome || 'Sem Subcategoria',
    forma_pagamento: apiTransaction.forma_pagamento,
    parcela: apiTransaction.parcela,
    total_parcelas: apiTransaction.total_parcelas,
    natureza: apiTransaction.natureza,
    data_transacao: apiTransaction.data_transacao,
  };
};

// Adaptador para converter formato antigo para novo
export const adaptLegacyTransaction = (legacyTransaction: any): Transaction => {
  return {
    id: legacyTransaction.id ? Number(legacyTransaction.id) : Date.now(),
    tipo: legacyTransaction.type === 'income' ? 'entrada' : 'saida',
    valor: legacyTransaction.amount,
    descricao: legacyTransaction.description,
    categoria_id: legacyTransaction.category_id || 0,
    subcategoria_id: legacyTransaction.subcategory_id || 0,
    categoria_nome: legacyTransaction.category,
    subcategoria_nome: legacyTransaction.subcategory || '',
    forma_pagamento: legacyTransaction.paymentMethod === 'cartao_credito' ? 'credito' : 
                     legacyTransaction.paymentMethod === 'cartao_debito' ? 'debito' : 
                     legacyTransaction.paymentMethod || 'dinheiro',
    parcela: legacyTransaction.currentInstallment ? Number(legacyTransaction.currentInstallment) : null,
    total_parcelas: legacyTransaction.installments ? Number(legacyTransaction.installments) : null,
    natureza: legacyTransaction.entityType || 'pf',
    data_transacao: legacyTransaction.date,
  };
};

// Função para converter novo formato para formato legado (compatibilidade)
export const convertToLegacyFormat = (transaction: Transaction): any => {
  return {
    id: transaction.id.toString(),
    type: transaction.tipo === 'entrada' ? 'income' : 'expense',
    amount: transaction.valor,
    description: transaction.descricao,
    category: transaction.categoria_nome,
    subcategory: transaction.subcategoria_nome,
    date: transaction.data_transacao,
    paymentMethod: transaction.forma_pagamento,
    installments: transaction.total_parcelas,
    currentInstallment: transaction.parcela,
    entityType: transaction.natureza,
  };
};