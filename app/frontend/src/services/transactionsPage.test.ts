import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ApiSchemaError } from '@/lib/parse';
import {
  FinancialService,
  TRANSACTIONS_MAX_PAGE_SIZE,
  YEAR_INVESTMENTS_MAX_PAGES,
} from './financialService';
import type { Transaction } from '@/types/financial';

const mockApiFetch = vi.fn();
vi.mock('@/lib/api', () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
}));

function transaction(id: number, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    type: 'expense',
    amount: 10,
    description: `Tx ${id}`,
    category_id: 1,
    subcategory_id: 2,
    category_name: 'Alimentacao',
    subcategory_name: 'Mercado',
    payment_method: 'pix',
    installment_number: null,
    total_installments: null,
    is_installment: false,
    bank_code: null,
    entity_type: 'individual',
    transaction_date: '2026-05-01T00:00:00',
    recurring_account_id: null,
    ...overrides,
  };
}

function page(items: Transaction[], nextCursor: string | null, total = items.length) {
  return {
    items,
    total,
    limit: 30,
    has_more: nextCursor !== null,
    next_cursor: nextCursor,
  };
}

function respondWith(body: unknown) {
  mockApiFetch.mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  });
}

function lastUrl(): URL {
  const calls = mockApiFetch.mock.calls;
  return new URL(String(calls[calls.length - 1][0]), 'http://api.test');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('FinancialService.getTransactionsPage', () => {
  it('parses a page at the boundary', async () => {
    respondWith(page([transaction(1)], 'abc', 5));

    const result = await FinancialService.getTransactionsPage({});

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(5);
    expect(result.next_cursor).toBe('abc');
  });

  it('sends only the filters that are set, mapping PF/PJ and DD/MM/YYYY dates', async () => {
    respondWith(page([], null));

    await FinancialService.getTransactionsPage({
      dateRange: { from: new Date(2026, 4, 1), to: new Date(2026, 4, 31) },
      entityType: 'pj',
      search: '  mercado ',
      categoryId: 7,
      type: 'income',
    });

    const params = lastUrl().searchParams;
    expect(lastUrl().pathname).toBe('/transacoes/paginated');
    expect(params.get('start_date')).toBe('01/05/2026');
    expect(params.get('end_date')).toBe('31/05/2026');
    expect(params.get('entity_type')).toBe('business');
    expect(params.get('search')).toBe('mercado');
    expect(params.get('category_id')).toBe('7');
    expect(params.get('type')).toBe('income');
    expect(params.get('limit')).toBe('30');
    expect(params.has('cursor')).toBe(false);
  });

  it('omits entity_type for "all", blank search and an absent cursor', async () => {
    respondWith(page([], null));

    await FinancialService.getTransactionsPage({ entityType: 'all', search: '   ' });

    const params = lastUrl().searchParams;
    expect(params.has('entity_type')).toBe(false);
    expect(params.has('search')).toBe(false);
  });

  it('forwards the cursor of the previous page', async () => {
    respondWith(page([], null));

    await FinancialService.getTransactionsPage({}, 'next-token');

    expect(lastUrl().searchParams.get('cursor')).toBe('next-token');
  });

  it('rejects a malformed page with ApiSchemaError', async () => {
    respondWith({ items: [{ id: 'x' }], total: 1 });

    await expect(FinancialService.getTransactionsPage({})).rejects.toBeInstanceOf(ApiSchemaError);
  });

  it('throws on an HTTP error', async () => {
    mockApiFetch.mockResolvedValueOnce({ ok: false, status: 500 });

    await expect(FinancialService.getTransactionsPage({})).rejects.toThrow(/500/);
  });
});

describe('FinancialService.getYearInvestments', () => {
  it('follows the cursor until the last page and requests only investments', async () => {
    respondWith(page([transaction(1, { type: 'investment' })], 'c1'));
    respondWith(page([transaction(2, { type: 'investment' })], null));

    const result = await FinancialService.getYearInvestments(2026, 'pf');

    expect(result.map((t) => t.id)).toEqual([1, 2]);
    expect(mockApiFetch).toHaveBeenCalledTimes(2);
    const first = new URL(String(mockApiFetch.mock.calls[0][0]), 'http://api.test').searchParams;
    expect(first.get('type')).toBe('investment');
    expect(first.get('start_date')).toBe('01/01/2026');
    expect(first.get('end_date')).toBe('31/12/2026');
    expect(first.get('entity_type')).toBe('individual');
    expect(first.get('limit')).toBe(String(TRANSACTIONS_MAX_PAGE_SIZE));
    expect(lastUrl().searchParams.get('cursor')).toBe('c1');
  });

  it('fails loudly instead of truncating when there are too many pages', async () => {
    for (let i = 0; i <= YEAR_INVESTMENTS_MAX_PAGES; i += 1) {
      respondWith(page([transaction(i + 1, { type: 'investment' })], `c${i}`));
    }

    await expect(FinancialService.getYearInvestments(2026)).rejects.toThrow(/Investimentos do ano/);
  });
});
