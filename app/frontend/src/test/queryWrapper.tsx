import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';

/** Fresh-data window of the test client, like production's: cached data is reused, not refetched. */
const TEST_STALE_TIME_MS = 60_000;

/** QueryClient for tests: no retries, no garbage collection delay, so failures surface at once. */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: TEST_STALE_TIME_MS, refetchOnWindowFocus: false },
      mutations: { retry: false },
    },
  });
}

/** Wrapper factory: `renderHook(..., { wrapper: createQueryWrapper(client) })`. */
export function createQueryWrapper(client: QueryClient = createTestQueryClient()) {
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

/** Renders `ui` inside a fresh QueryClientProvider; returns the client for cache assertions. */
export function renderWithQuery(
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'> & { client?: QueryClient },
): RenderResult & { client: QueryClient } {
  const client = options?.client ?? createTestQueryClient();
  const result = render(ui, { ...options, wrapper: createQueryWrapper(client) });
  return { ...result, client };
}
