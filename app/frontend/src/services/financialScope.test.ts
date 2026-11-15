import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FinancialService } from './financialService';

const mockApiFetch = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

const range = { from: new Date(2026, 4, 1), to: new Date(2026, 4, 31) };

/** Query string of the last request. */
function lastQuery(): URLSearchParams {
  const calls = mockApiFetch.mock.calls;
  return new URL(String(calls[calls.length - 1][0]), 'http://api.test').searchParams;
}

/** Answers every request with an invalid body: only the requested URL matters here. */
beforeEach(() => {
  vi.clearAllMocks();
  mockApiFetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({}), text: async () => '{}' });
});

/** The dashboard endpoints (statement, yearly, categories) and the scope they receive. */
const DASHBOARD_CALLS: Array<[string, (scope?: string) => Promise<unknown>]> = [
  ['statement', (scope) => FinancialService.getFinancialSummary(range, scope)],
  ['yearly performance', (scope) => FinancialService.getYearlyPerformance(2026, scope)],
  ['expenses by category', (scope) => FinancialService.getCategoryBreakdown(range, scope)],
  ['income by category', (scope) => FinancialService.getCategoryIncome(range, scope)],
];

describe.each(DASHBOARD_CALLS)('PF/PJ scope of the %s request', (_name, call) => {
  it('"all" (Ambos) asks the backend for both natures', async () => {
    await call('all').catch(() => undefined);
    expect(lastQuery().get('entity_type')).toBe('all');
  });

  it('maps pf to individual and pj to business', async () => {
    await call('pf').catch(() => undefined);
    expect(lastQuery().get('entity_type')).toBe('individual');
    await call('pj').catch(() => undefined);
    expect(lastQuery().get('entity_type')).toBe('business');
  });

  it('keeps individual as the default when no scope is given', async () => {
    await call(undefined).catch(() => undefined);
    expect(lastQuery().get('entity_type')).toBe('individual');
  });
});

describe('PF/PJ scope of the transactions list request', () => {
  it('sends no entity_type for "all" so every nature is listed', async () => {
    await FinancialService.getTransactionsPage({ entityType: 'all' }).catch(() => undefined);
    expect(lastQuery().has('entity_type')).toBe(false);
  });
});
