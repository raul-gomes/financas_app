import { describe, it, expect, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import { createTestQueryClient } from '@/test/queryWrapper';
import { invalidateRecurringData } from './useRecurringQueries';

/** Seeds a cache entry so `invalidateQueries` has something to mark stale. */
function seed(client: QueryClient, key: readonly unknown[]): void {
  client.setQueryData(key, []);
}

describe('invalidateRecurringData', () => {
  it('refreshes the recurring accounts and the transaction data they generate', async () => {
    const client = createTestQueryClient();
    const range = { from: new Date(2026, 4, 1), to: new Date(2026, 4, 31) };
    const recurring = queryKeys.recurring.list(undefined);
    const financial = queryKeys.financial.summary(range, 'pf');
    const overview = queryKeys.overview.detail(2026, 5, 'all');
    const settings = queryKeys.settings.banks();
    [recurring, financial, overview, settings].forEach((key) => seed(client, key));
    const invalidate = vi.spyOn(client, 'invalidateQueries');

    await invalidateRecurringData(client);

    const invalidated = invalidate.mock.calls.map(([filters]) => filters?.queryKey);
    expect(invalidated).toContainEqual(queryKeys.recurring.all);
    expect(invalidated).toContainEqual(queryKeys.transactions.all);
    expect(invalidated).toContainEqual(queryKeys.financial.all);
    expect(client.getQueryState(recurring)?.isInvalidated).toBe(true);
    expect(client.getQueryState(financial)?.isInvalidated).toBe(true);
    expect(client.getQueryState(overview)?.isInvalidated).toBe(true);
    expect(client.getQueryState(settings)?.isInvalidated).toBe(false);
  });
});
