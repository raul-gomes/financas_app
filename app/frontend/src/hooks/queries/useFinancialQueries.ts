import { useMemo } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { FinancialService } from '@/services/financialService';
import { queryKeys, type DateRangeInput } from '@/lib/queryKeys';
import type { YearMonth } from '@/lib/months';
import { buildRecentMonths, MOBILE_CHART_MONTHS, recentMonthYears } from '@/lib/recentMonths';

/**
 * Statement of the period (totals, goal, limits and the chart aggregates; the rows come
 * from the paginated transactions list).
 * Keeps the previous period's data on screen while the next one loads
 * (`isPlaceholderData` tells them apart).
 */
export function useFinancialSummary(range: DateRangeInput, entityType: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.financial.summary(range, entityType),
    queryFn: () => FinancialService.getFinancialSummary(range, entityType),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Income/expense per month of the year. */
export function useYearlyPerformance(year: number, entityType: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.financial.yearly(year, entityType),
    queryFn: () => FinancialService.getYearlyPerformance(year, entityType),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Expenses (or income) per category for the period. */
export function useCategoryBreakdown(
  range: DateRangeInput,
  entityType: string,
  type: string,
  enabled = true,
) {
  return useQuery({
    queryKey: queryKeys.financial.categoryBreakdown(range, entityType, type),
    queryFn: () => FinancialService.getCategoryBreakdown(range, entityType, type),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Income per subcategory for the period. */
export function useCategoryIncome(range: DateRangeInput, entityType: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.financial.categoryIncome(range, entityType),
    queryFn: () => FinancialService.getCategoryIncome(range, entityType),
    placeholderData: keepPreviousData,
    enabled,
  });
}

/** Categories with their subcategories (options of the review selects), optionally by type. */
export function useCategoryOptions(entityType: string, type?: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.financial.categoryOptions(entityType, type),
    queryFn: () => FinancialService.getCategorySubcategories(entityType, type),
    enabled,
  });
}

/**
 * Income/expense of the last 6 months ending at `end` (mobile bar chart). Reuses the
 * yearly queries (shared cache with the desktop chart) and reads the previous year too
 * when the window crosses the new year.
 */
export function useRecentMonths(end: YearMonth, entityType: string) {
  const needsPreviousYear = recentMonthYears(end, MOBILE_CHART_MONTHS).length > 1;
  const current = useYearlyPerformance(end.year, entityType);
  const previous = useYearlyPerformance(end.year - 1, entityType, needsPreviousYear);
  const months = useMemo(
    () => buildRecentMonths(end, MOBILE_CHART_MONTHS, { [end.year]: current.data, [end.year - 1]: previous.data }),
    [end, current.data, previous.data],
  );
  const isPending = current.isPending || (needsPreviousYear && previous.isPending);
  return { months, isPending };
}
