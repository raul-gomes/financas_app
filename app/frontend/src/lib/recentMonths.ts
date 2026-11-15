import { addMonths, SHORT_MONTHS, type YearMonth } from '@/lib/months';

/** Months shown by the mobile bar chart. */
export const MOBILE_CHART_MONTHS = 6;

/** Income/expense per month of one year, in calendar order (the `/dashboard/period-income` payload). */
export interface YearPerformance {
  limit: number;
  months: Record<string, { income: number; expense: number }>;
}

export interface RecentMonth extends YearMonth {
  /** Axis label, e.g. "nov". */
  label: string;
  income: number;
  expenses: number;
}

/** The `count` months ending at `end`, oldest first. */
function windowOf(end: YearMonth, count: number): YearMonth[] {
  return Array.from({ length: count }, (_, i) => addMonths(end, i - (count - 1)));
}

/** Years whose data the window needs: the end year first, then the previous one if crossed. */
export function recentMonthYears(end: YearMonth, count: number): number[] {
  const years: number[] = [];
  for (const { year } of [end, ...windowOf(end, count)]) {
    if (!years.includes(year)) years.push(year);
  }
  return years.sort((a, b) => b - a);
}

/**
 * Income and expenses of the last `count` months ending at `end`. Months come from the
 * yearly payloads by calendar position; a year that has not loaded counts as zero.
 */
export function buildRecentMonths(
  end: YearMonth,
  count: number,
  yearly: Record<number, YearPerformance | undefined>,
): RecentMonth[] {
  return windowOf(end, count).map(({ year, month }) => {
    const values = Object.values(yearly[year]?.months ?? {})[month - 1];
    return {
      year,
      month,
      label: SHORT_MONTHS[month - 1],
      income: values?.income ?? 0,
      expenses: values?.expense ?? 0,
    };
  });
}
