// Utilitários de formatação compartilhados (fonte única — não duplique Intl aqui)

/**
 * Moeda padrão do app. Hoje fixa em BRL; no futuro virá do perfil do usuário
 * (multi-moeda — ver docs/backlog.md). As funções já aceitam o parâmetro
 * opcional para que a troca não exija mudar nenhum call site.
 */
export const DEFAULT_CURRENCY = 'BRL';

/** Locale único do app: todo número, moeda e data é exibido em pt-BR. */
export const APP_LOCALE = 'pt-BR';

const currencyFormatters = new Map<string, Intl.NumberFormat>();

const getCurrencyFormatter = (currency: string): Intl.NumberFormat => {
  let fmt = currencyFormatters.get(currency);
  if (!fmt) {
    fmt = new Intl.NumberFormat(APP_LOCALE, { style: 'currency', currency });
    currencyFormatters.set(currency, fmt);
  }
  return fmt;
};

/** Moeda em pt-BR, ex.: "R$ 5.865,00". */
export const formatCurrency = (value: number, currency: string = DEFAULT_CURRENCY): string =>
  getCurrencyFormatter(currency).format(value);

/** Número em pt-BR (separador de milhar "." e decimal ","), sem símbolo de moeda. */
export const formatNumber = (value: number, options?: Intl.NumberFormatOptions): string =>
  value.toLocaleString(APP_LOCALE, options);

const compactFormatter = new Intl.NumberFormat(APP_LOCALE, { notation: 'compact', maximumFractionDigits: 1 });

/** Número abreviado em pt-BR para eixos de gráfico, ex.: "5 mil". */
export const formatCompactNumber = (value: number): string => compactFormatter.format(value);

/**
 * Formata datas 'YYYY-MM-DD' ou ISO completas (dd/mm/aaaa) sem sofrer deslocamento
 * de fuso (anexa T12:00:00 quando a string é só data).
 */
export const formatDate = (dateStr: string): string =>
  new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`).toLocaleDateString(APP_LOCALE);

/** Porcentagem em pt-BR com vírgula decimal, ex.: "12,35%". */
export const formatPercent = (value: number, digits = 2): string =>
  `${formatNumber(value, { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

/**
 * Escapa texto para uso dentro de HTML montado como string (tooltips do D3).
 * Todo dado que vem da API (ex.: nome de categoria) passa por aqui antes de `.html()`.
 */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
