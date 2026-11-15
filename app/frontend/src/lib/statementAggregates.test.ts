import { describe, it, expect } from 'vitest';
import {
  buildDailyData,
  methodTotal,
  bankItemsForMethod,
  installmentBankItems,
  NO_BANK_LABEL,
} from './statementAggregates';
import type { StatementBankTotal, StatementInstallmentsDue } from '@/types/financial';

describe('buildDailyData', () => {
  it('lists every day of the month with zeros where there are no totals', () => {
    const days = buildDailyData([], { year: 2026, index: 1 });
    expect(days).toHaveLength(28);
    expect(days[0]).toEqual({ day: 1, income: 0, expenses: 0, investment: 0 });
  });

  it('places each daily total on its calendar day without timezone shifts', () => {
    const days = buildDailyData(
      [
        { date: '2026-03-01', income: 10, expenses: 2, investment: 1 },
        { date: '2026-03-31', income: 0, expenses: 5, investment: 0 },
      ],
      { year: 2026, index: 2 },
    );
    expect(days).toHaveLength(31);
    expect(days[0]).toEqual({ day: 1, income: 10, expenses: 2, investment: 1 });
    expect(days[30]).toMatchObject({ day: 31, expenses: 5 });
  });

  it('ignores totals of other months or years', () => {
    const days = buildDailyData(
      [
        { date: '2026-02-10', income: 99, expenses: 99, investment: 99 },
        { date: '2025-03-10', income: 99, expenses: 99, investment: 99 },
      ],
      { year: 2026, index: 2 },
    );
    expect(days.every((d) => d.income === 0 && d.expenses === 0 && d.investment === 0)).toBe(true);
  });
});

describe('methodTotal', () => {
  const totals = [
    { payment_method: 'pix', total: 30 },
    { payment_method: 'credit', total: 70 },
  ];
  it('returns the total of a payment method', () => {
    expect(methodTotal(totals, 'credit')).toBe(70);
  });
  it('returns 0 when the method has no expenses', () => {
    expect(methodTotal(totals, 'debit')).toBe(0);
  });
});

describe('bankItemsForMethod', () => {
  const rows: StatementBankTotal[] = [
    { payment_method: 'pix', bank_code: '260', bank_name: 'Nubank', total: 10 },
    { payment_method: 'credit', bank_code: '260', bank_name: 'Nubank', total: 20 },
    { payment_method: 'pix', bank_code: '341', bank_name: 'Itaú', total: 5 },
  ];
  it('keeps only the rows of the method, mapped to breakdown items', () => {
    expect(bankItemsForMethod(rows, 'pix')).toEqual([
      { bank_code: '260', bank_name: 'Nubank', amount: 10 },
      { bank_code: '341', bank_name: 'Itaú', amount: 5 },
    ]);
  });
  it('is empty for a method without rows', () => {
    expect(bankItemsForMethod(rows, 'debit')).toEqual([]);
  });
});

describe('installmentBankItems', () => {
  it('maps banks and labels the no-bank group', () => {
    const due: StatementInstallmentsDue = {
      remaining_amount: 30,
      remaining_installments: 3,
      transactions: 2,
      by_bank: [
        { bank_code: '260', bank_name: 'Nubank', remaining_amount: 20, remaining_installments: 2, transactions: 1 },
        { bank_code: null, bank_name: 'Sem banco', remaining_amount: 10, remaining_installments: 1, transactions: 1 },
      ],
    };
    expect(installmentBankItems(due)).toEqual([
      { bank_code: '260', bank_name: 'Nubank', amount: 20 },
      { bank_code: '', bank_name: NO_BANK_LABEL, amount: 10 },
    ]);
  });
});
