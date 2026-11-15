import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { OverviewService } from '@/services/overviewService';
import { queryKeys } from '@/lib/queryKeys';

/** Entity scope accepted by the overview endpoint. */
export type OverviewEntityType = 'individual' | 'business' | 'all';

/**
 * Main-screen overview for a month; keeps the previous month visible while the next loads.
 * The backend owns the recurring bills (creating an account already inserts its installments),
 * so the browser only reads.
 *
 * @param year - Calendar year of the month.
 * @param month - Month number, 1-12.
 * @param entityType - PF, PJ or both.
 */
export function useOverviewQuery(year: number, month: number, entityType: OverviewEntityType) {
  return useQuery({
    queryKey: queryKeys.overview.detail(year, month, entityType),
    queryFn: () => OverviewService.getOverview(year, month, entityType),
    placeholderData: keepPreviousData,
  });
}
