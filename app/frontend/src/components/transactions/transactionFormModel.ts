import type { Transaction } from '@/types/financial';

/** Values of the transaction form (shared by the create and edit dialogs). */
export interface TransactionFormValues {
  type: Transaction['type'];
  /** Canonical decimal string with a dot ("1234.56"); "" = empty. */
  amount: string;
  description: string;
  category_name: string;
  subcategory_name: string;
  /** ISO date `yyyy-mm-dd`; "" while the typed date is incomplete or invalid. */
  transaction_date: string;
  payment_method: string;
  total_installments: string | null;
  entity_type: Transaction['entity_type'];
}

/** Payment methods built into the form; anything else is a user-typed method ("Outro"). */
export const KNOWN_PAYMENT_METHODS = ['cash', 'pix', 'debit', 'credit', 'transfer'] as const;

/** Category names the backend uses for income and investments (shown translated). */
export const AUTO_CATEGORY_BY_TYPE = { income: 'Income', investment: 'Investments' } as const;

const DATE_DIGITS = 8;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Masks digits as dd/mm/aaaa while the user types. */
export const maskDateBR = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, DATE_DIGITS);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

/** dd/mm/aaaa to ISO; "" when incomplete or not a real date (e.g. 31/02). */
export const brToIso = (br: string): string => {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const date = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(date.getTime()) || date.getDate() !== Number(m[1])) return '';
  return iso;
};

/** ISO date to dd/mm/aaaa (other strings are returned as they are). */
export const isoToBr = (iso: string): string => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

/** Whether `value` is a complete ISO date. */
export const isIsoDate = (value: string): boolean => ISO_DATE_PATTERN.test(value);

/** Local calendar day as ISO (the form never uses UTC, which can be tomorrow at night). */
export function toIsoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Blank form: a cash expense of `today` for the individual scope. */
export function emptyFormValues(today: Date): TransactionFormValues {
  return {
    type: 'expense',
    amount: '',
    description: '',
    category_name: '',
    subcategory_name: '',
    transaction_date: toIsoDay(today),
    payment_method: 'cash',
    total_installments: null,
    entity_type: 'individual',
  };
}

/** Editable values of an existing transaction. */
export function valuesFromTransaction(t: Transaction): TransactionFormValues {
  return {
    type: t.type,
    amount: String(t.amount),
    description: t.description,
    category_name: t.category_name ?? '',
    subcategory_name: t.subcategory_name ?? '',
    transaction_date: t.transaction_date.split('T')[0],
    payment_method: t.payment_method,
    total_installments: t.total_installments === null ? null : String(t.total_installments),
    entity_type: t.entity_type,
  };
}

export function isKnownPaymentMethod(method: string): boolean {
  return (KNOWN_PAYMENT_METHODS as readonly string[]).includes(method);
}

/** Value of each installment, or null when it is not an installment purchase or the inputs are incomplete. */
export function installmentValue(isInstallment: boolean, amount: string, installments: string | null): number | null {
  if (!isInstallment || !installments || !amount) return null;
  const count = parseInt(installments, 10);
  if (!(count > 0)) return null;
  return parseFloat(amount) / count;
}
