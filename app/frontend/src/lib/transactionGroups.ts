import { formatCurrency } from '@/lib/format';
import type { Transaction } from '@/types/financial';

/** Abbreviated pt-BR month names used in day headings ("14 nov"). */
const MONTH_ABBREVIATIONS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;

/** Length of the `YYYY-MM-DD` prefix of an ISO date or timestamp. */
const ISO_DAY_LENGTH = 10;

/** Minus sign used before expense amounts (U+2212, not a hyphen). */
const MINUS_SIGN = '−';

export interface DayGroup {
  /** `YYYY-MM-DD` of the day. */
  key: string;
  /** Heading shown above the group, e.g. "Hoje · 14 nov". */
  label: string;
  items: Transaction[];
}

/** Calendar day (`YYYY-MM-DD`) of a backend date, ignoring time and time zone. */
function dayKey(date: string): string {
  return date.slice(0, ISO_DAY_LENGTH);
}

function localDayKey(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Heading for a day of the transactions list: "Hoje · 14 nov", "Ontem · 13 nov",
 * "12 nov" (plus the year when it is not the current one).
 */
export function formatDayHeading(date: string, now: Date): string {
  const key = dayKey(date);
  const [year, month, day] = key.split('-').map(Number);
  const short = `${day} ${MONTH_ABBREVIATIONS[month - 1]}`;
  if (key === localDayKey(now)) return `Hoje · ${short}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  if (key === localDayKey(yesterday)) return `Ontem · ${short}`;
  return year === now.getFullYear() ? short : `${short} ${year}`;
}

/** Groups an already sorted list by calendar day, keeping the incoming order. */
export function groupTransactionsByDay(transactions: Transaction[], now: Date): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const transaction of transactions) {
    const key = dayKey(transaction.transaction_date);
    const last = groups[groups.length - 1];
    if (last && last.key === key) {
      last.items.push(transaction);
    } else {
      groups.push({ key, label: formatDayHeading(transaction.transaction_date, now), items: [transaction] });
    }
  }
  return groups;
}

/** Amount with sign for list rows: "+R$ 10,00" for income, "−R$ 10,00" otherwise. */
export function signedAmount(transaction: Pick<Transaction, 'type' | 'amount'>): string {
  const value = formatCurrency(transaction.amount);
  return transaction.type === 'income' ? `+${value}` : `${MINUS_SIGN}${value}`;
}
