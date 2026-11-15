import type { BankBreakdownItem } from '@/components/dialogs/BankBreakdownModal';
import type {
  DailyData,
  StatementAggregates,
  StatementBankTotal,
  StatementDailyTotal,
  StatementInstallmentsDue,
  StatementPaymentMethodTotal,
} from '@/types/financial';

/** Label of the installments group whose transactions have no bank. */
export const NO_BANK_LABEL = 'Sem banco';

/** Aggregates shown while the statement is still loading (everything zero). */
export const EMPTY_STATEMENT_AGGREGATES: StatementAggregates = {
  daily_totals: [],
  expenses_by_payment_method: [],
  expenses_by_bank: [],
  installments_due: { remaining_amount: 0, remaining_installments: 0, transactions: 0, by_bank: [] },
};

/** A calendar month: `index` is zero-based (January = 0). */
export interface CalendarMonth {
  year: number;
  index: number;
}

/**
 * Daily chart data of one month from the statement's `daily_totals`. Every day of the
 * month is listed (zeros where nothing happened). The ISO date is split, never parsed
 * with `Date`, so the day cannot shift with the browser timezone.
 */
export function buildDailyData(dailyTotals: StatementDailyTotal[], month: CalendarMonth): DailyData[] {
  const daysInMonth = new Date(month.year, month.index + 1, 0).getDate();
  const days: DailyData[] = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    income: 0,
    expenses: 0,
    investment: 0,
  }));
  for (const total of dailyTotals) {
    const [year, monthNumber, day] = total.date.split('-').map(Number);
    if (year !== month.year || monthNumber - 1 !== month.index) continue;
    const cell = days[day - 1];
    if (!cell) continue;
    cell.income += total.income;
    cell.expenses += total.expenses;
    cell.investment += total.investment;
  }
  return days;
}

/** Expenses of one payment method (0 when it has none). */
export function methodTotal(totals: StatementPaymentMethodTotal[], method: string): number {
  return totals.find((t) => t.payment_method === method)?.total ?? 0;
}

/** Per-bank breakdown items of one payment method's expenses. */
export function bankItemsForMethod(rows: StatementBankTotal[], method: string): BankBreakdownItem[] {
  return rows
    .filter((row) => row.payment_method === method)
    .map((row) => ({ bank_code: row.bank_code, bank_name: row.bank_name, amount: row.total }));
}

/** Per-bank breakdown items of the installments still to pay. */
export function installmentBankItems(due: StatementInstallmentsDue): BankBreakdownItem[] {
  return due.by_bank.map((bank) => ({
    bank_code: bank.bank_code ?? '',
    bank_name: bank.bank_code ? bank.bank_name : NO_BANK_LABEL,
    amount: bank.remaining_amount,
  }));
}
