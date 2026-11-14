import { format } from 'date-fns';

/** Date range as received from the screens. */
export interface DateRangeInput {
  from: Date;
  to: Date;
}

/** Calendar days make stable, serializable cache keys (a `Date` would carry the time of day). */
const KEY_DATE_FORMAT = 'yyyy-MM-dd';

function rangeKey(range: DateRangeInput): { from: string; to: string } {
  return { from: format(range.from, KEY_DATE_FORMAT), to: format(range.to, KEY_DATE_FORMAT) };
}

/** Filters that identify one cached transactions list. */
export interface TransactionListKeyFilters {
  dateRange: DateRangeInput;
  entityType: string;
  search: string;
}

/**
 * Query keys factory: the single place where cache keys are built, so queries and
 * invalidations stay in sync. Each domain exposes `all` (prefix used to invalidate it).
 */
export const queryKeys = {
  transactions: {
    all: ['transactions'] as const,
    list: (filters: TransactionListKeyFilters) =>
      [
        'transactions',
        'list',
        { ...rangeKey(filters.dateRange), entityType: filters.entityType, search: filters.search },
      ] as const,
    yearInvestments: (year: number, entityType: string) =>
      ['transactions', 'year-investments', year, entityType] as const,
  },
  financial: {
    all: ['financial'] as const,
    summary: (range: DateRangeInput, entityType: string) =>
      ['financial', 'summary', rangeKey(range), entityType] as const,
    yearly: (year: number, entityType: string) => ['financial', 'yearly', year, entityType] as const,
    categoryBreakdown: (range: DateRangeInput, entityType: string, type: string) =>
      ['financial', 'category-breakdown', rangeKey(range), entityType, type] as const,
    categoryIncome: (range: DateRangeInput, entityType: string) =>
      ['financial', 'category-income', rangeKey(range), entityType] as const,
  },
  overview: {
    all: ['overview'] as const,
    detail: (year: number, month: number, entityType: string) =>
      ['overview', year, month, entityType] as const,
  },
  limits: {
    all: ['limits'] as const,
    /** Prefix of every month's spending (refreshed when transactions change; not the edit draft). */
    spendingAll: ['limits', 'with-spending'] as const,
    categories: () => ['limits', 'categories'] as const,
    withSpending: (year: number, month: number) => ['limits', 'with-spending', year, month] as const,
  },
  recurring: {
    all: ['recurring-accounts'] as const,
    list: (entityType: string | undefined) => ['recurring-accounts', 'list', entityType ?? 'all'] as const,
    generation: (range: DateRangeInput) => ['recurring-accounts', 'generation', rangeKey(range)] as const,
  },
  goals: {
    all: ['goals'] as const,
    list: (entityType: string | undefined) => ['goals', 'list', entityType ?? 'all'] as const,
    progress: (year: number, month: number, entityType: string | undefined) =>
      ['goals', 'progress', year, month, entityType ?? 'all'] as const,
  },
  shopping: {
    all: ['shopping'] as const,
    month: (referenceMonth: string, entityType: string | undefined) =>
      ['shopping', 'month', referenceMonth, entityType ?? 'all'] as const,
  },
  settings: {
    all: ['settings'] as const,
    profile: () => ['settings', 'profile'] as const,
    banks: () => ['settings', 'banks'] as const,
  },
};
