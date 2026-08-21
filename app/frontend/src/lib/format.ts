// Utilitários de formatação compartilhados (fonte única — não duplique Intl aqui)

/**
 * Moeda padrão do app. Hoje fixa em BRL; no futuro virá do perfil do usuário
 * (multi-moeda — ver docs/backlog.md). As funções já aceitam o parâmetro
 * opcional para que a troca não exija mudar nenhum call site.
 */
export const DEFAULT_CURRENCY = 'BRL';

const formatters = new Map<string, Intl.NumberFormat>();

const getCurrencyFormatter = (currency: string): Intl.NumberFormat => {
  let fmt = formatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency });
    formatters.set(currency, fmt);
  }
  return fmt;
};

export const formatCurrency = (value: number, currency: string = DEFAULT_CURRENCY): string =>
  getCurrencyFormatter(currency).format(value);

/**
 * Formata datas 'YYYY-MM-DD' ou ISO completas sem sofrer deslocamento de fuso
 * (anexa T12:00:00 quando a string é só data).
 */
export const formatDate = (dateStr: string): string =>
  new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`).toLocaleDateString('en-US');

export const formatPercent = (value: number, digits = 2): string =>
  `${value.toFixed(digits)}%`;
