/** pt-BR labels for the payment methods the backend stores (anything else is a user-typed method). */
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  cash: 'Dinheiro',
  pix: 'Pix',
  debit: 'Débito',
  credit: 'Crédito',
  transfer: 'Transferência',
  // Values written by imports and older data (Portuguese spellings)
  dinheiro: 'Dinheiro',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferência',
  boleto: 'Boleto',
};

/** Names shown for the automatic categories (internally they follow the backend naming). */
const CATEGORY_LABELS: Record<string, string> = {
  Income: 'Receita',
  Investments: 'Investimentos',
};

const TRANSACTION_TYPE_LABELS = {
  income: 'Entrada',
  expense: 'Saída',
  investment: 'Investimento',
} as const;

/** Label of a payment method; unknown (custom) methods are returned as typed. */
export function paymentMethodLabel(method: string): string {
  return PAYMENT_METHOD_LABELS[method] ?? method;
}

/** Label of a category; the automatic ones ("Income", "Investments") are translated. */
export function categoryLabel(name: string | null | undefined): string {
  if (!name) return 'Sem categoria';
  return CATEGORY_LABELS[name] ?? name;
}

/** Label of a transaction type. */
export function transactionTypeLabel(type: keyof typeof TRANSACTION_TYPE_LABELS): string {
  return TRANSACTION_TYPE_LABELS[type];
}
