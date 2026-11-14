import { QueryCache, QueryClient } from '@tanstack/react-query';

/** Data stays fresh for 5 minutes: avoids a refetch on every mount. */
export const QUERY_STALE_TIME_MS = 1000 * 60 * 5;
/** Unused cache entries are kept for 30 minutes after unmount. */
export const QUERY_GC_TIME_MS = 1000 * 60 * 30;
/** One automatic retry for transient network failures. */
export const QUERY_RETRY_COUNT = 1;

/**
 * Builds the app's QueryClient. Query failures are logged in one place (the cache's
 * `onError`), so screens only decide how to render the error state.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        console.error('Erro ao carregar dados:', query.queryKey[0], error);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: QUERY_STALE_TIME_MS,
        gcTime: QUERY_GC_TIME_MS,
        refetchOnWindowFocus: false,
        retry: QUERY_RETRY_COUNT,
      },
    },
  });
}
