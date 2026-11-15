/** A calendar month; `month` is 1-12. */
export interface YearMonth {
  year: number;
  month: number;
}

/** Short pt-BR month names ("nov"). */
export const SHORT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;

/** Months in a year, used to roll the year over. */
const MONTHS_PER_YEAR = 12;

/** The month `delta` months after (or before, if negative) `from`. */
export function addMonths(from: YearMonth, delta: number): YearMonth {
  const index = from.year * MONTHS_PER_YEAR + (from.month - 1) + delta;
  return { year: Math.floor(index / MONTHS_PER_YEAR), month: (index % MONTHS_PER_YEAR) + 1 };
}

/** The month a date falls in. */
export function toYearMonth(date: Date): YearMonth {
  return { year: date.getFullYear(), month: date.getMonth() + 1 };
}
