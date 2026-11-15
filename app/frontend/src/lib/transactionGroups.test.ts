import { describe, it, expect } from 'vitest';
import { formatDayHeading, groupTransactionsByDay, signedAmount } from './transactionGroups';
import type { Transaction } from '@/types/financial';

const TODAY = new Date(2026, 10, 14, 15, 30); // 14 Nov 2026, local time

function tx(id: number, date: string, overrides: Partial<Transaction> = {}): Transaction {
  return {
    id,
    type: 'expense',
    amount: 10,
    description: `T${id}`,
    category_id: 1,
    subcategory_id: 1,
    category_name: 'Lazer',
    subcategory_name: 'Streaming',
    payment_method: 'pix',
    installment_number: null,
    total_installments: null,
    is_installment: false,
    bank_code: null,
    entity_type: 'individual',
    transaction_date: date,
    recurring_account_id: null,
    ...overrides,
  };
}

describe('formatDayHeading', () => {
  it('labels today, yesterday and older days in pt-BR', () => {
    expect(formatDayHeading('2026-11-14T00:00:00', TODAY)).toBe('Hoje · 14 nov');
    expect(formatDayHeading('2026-11-13', TODAY)).toBe('Ontem · 13 nov');
    expect(formatDayHeading('2026-11-12T00:00:00', TODAY)).toBe('12 nov');
  });

  it('adds the year only when it differs from the current one', () => {
    expect(formatDayHeading('2025-12-31T00:00:00', TODAY)).toBe('31 dez 2025');
  });

  it('does not shift the day with the time zone of an ISO timestamp', () => {
    expect(formatDayHeading('2026-11-01T00:00:00', TODAY)).toBe('1 nov');
  });
});

describe('groupTransactionsByDay', () => {
  it('groups consecutive items of the same day keeping the incoming order', () => {
    const groups = groupTransactionsByDay(
      [tx(1, '2026-11-14T00:00:00'), tx(2, '2026-11-14T00:00:00'), tx(3, '2026-11-12T00:00:00')],
      TODAY,
    );
    expect(groups.map((g) => [g.key, g.label, g.items.map((t) => t.id)])).toEqual([
      ['2026-11-14', 'Hoje · 14 nov', [1, 2]],
      ['2026-11-12', '12 nov', [3]],
    ]);
  });

  it('returns no groups for an empty list', () => {
    expect(groupTransactionsByDay([], TODAY)).toEqual([]);
  });
});

describe('signedAmount', () => {
  it('prefixes income with + and expense/investment with a true minus sign', () => {
    expect(signedAmount(tx(1, '2026-11-14', { type: 'income', amount: 10120 }))).toMatch(/^\+R\$\s10\.120,00$/);
    expect(signedAmount(tx(2, '2026-11-14', { amount: 55.9 }))).toMatch(/^−R\$\s55,90$/);
    expect(signedAmount(tx(3, '2026-11-14', { type: 'investment', amount: 100 }))).toMatch(/^−R\$\s100,00$/);
  });
});
