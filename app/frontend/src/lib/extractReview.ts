import type { ConfirmTransaction, ParsedTransaction, SessionData } from '@/types/extract';
import type { CategorySubcategories, DuplicateInfo } from '@/types/financial';

/** Value of the "Outros..." option of the payment method, category and subcategory selects. */
export const OTHER_OPTION = 'outros';
/** Installments suggested when a row is turned into an installment purchase. */
export const DEFAULT_INSTALLMENTS = 2;
/** Value of the "add a new bank" option of the bank select. */
export const ADD_BANK_OPTION = '+add';
/** Fewest installments an installment purchase may have. */
export const MIN_INSTALLMENTS = 2;

let lastRowId = 0;

/** New id for a parsed row. Unique for the lifetime of the page and stable while the row is edited or moved. */
export function nextRowId(): string {
  lastRowId += 1;
  return `row-${lastRowId}`;
}

/**
 * Extra state of one review row that is not part of the parsed transaction: the free-text
 * ("Outros...") choices of payment method, category and subcategory, and the installments.
 */
export interface RowDraft {
  customPaymentMethod: boolean;
  paymentMethodName: string;
  customCategory: boolean;
  categoryName: string;
  customSubcategory: boolean;
  subcategoryName: string;
  installment: boolean;
  totalInstallments?: number;
}

/** Drafts of every row, by the row's `rowId` (so they follow the row when others are removed). A row without an entry has the empty draft. */
export type RowDrafts = Record<string, RowDraft>;

export const EMPTY_ROW_DRAFT: RowDraft = {
  customPaymentMethod: false,
  paymentMethodName: '',
  customCategory: false,
  categoryName: '',
  customSubcategory: false,
  subcategoryName: '',
  installment: false,
};

/** What a user edit changes: the row's draft and/or the parsed transaction itself. */
export interface RowChange {
  draft: Partial<RowDraft>;
  transaction: Partial<ParsedTransaction>;
}

/** The user picked a payment method (or "Outros..." to type a new one). */
export function changePaymentMethod(value: string): RowChange {
  if (value === OTHER_OPTION) {
    return { draft: { customPaymentMethod: true }, transaction: { payment_method: '' } };
  }
  return {
    draft: { customPaymentMethod: false, paymentMethodName: '' },
    transaction: { payment_method: value },
  };
}

/** The user typed a new payment method name. */
export function typePaymentMethodName(name: string): RowChange {
  return { draft: { paymentMethodName: name }, transaction: { payment_method: name } };
}

/** The user picked a category (or "Outros..."); a real category selects its first subcategory. */
export function changeCategory(value: string, options: CategorySubcategories | null): RowChange {
  if (value === OTHER_OPTION) {
    return {
      draft: { customCategory: true },
      transaction: { category_id: undefined, subcategory_id: undefined },
    };
  }
  const categoryId = parseInt(value);
  const firstSubcategory = options?.options.find((c) => c.id === categoryId)?.subcategories[0];
  return {
    draft: { customCategory: false, categoryName: '' },
    transaction: { category_id: categoryId, subcategory_id: firstSubcategory?.id },
  };
}

/** The user typed a new category name (the row no longer points to a category id). */
export function typeCategoryName(name: string): RowChange {
  return { draft: { categoryName: name }, transaction: { category_id: undefined } };
}

/** The user picked a subcategory (or "Outros..." to type a new one). */
export function changeSubcategory(value: string): RowChange {
  if (value === OTHER_OPTION) {
    return { draft: { customSubcategory: true }, transaction: { subcategory_id: undefined } };
  }
  return {
    draft: { customSubcategory: false, subcategoryName: '' },
    transaction: { subcategory_id: parseInt(value) },
  };
}

/** The user typed a new subcategory name (the row no longer points to a subcategory id). */
export function typeSubcategoryName(name: string): RowChange {
  return { draft: { subcategoryName: name }, transaction: { subcategory_id: undefined } };
}

/** Draft patch of the installments switch: turning it on suggests the default total. */
export function toggleInstallment(draft: RowDraft, checked: boolean): Partial<RowDraft> {
  return {
    installment: checked,
    totalInstallments: checked && !draft.totalInstallments ? DEFAULT_INSTALLMENTS : draft.totalInstallments,
  };
}

/** Total typed in the installments input; anything that is not a number falls back to the default. */
export function parseTotalInstallments(raw: string): number {
  return parseInt(raw) || DEFAULT_INSTALLMENTS;
}

/** Inline validation messages of one row (pt-BR), by field. */
export interface TransactionErrors {
  description?: string;
  amount?: string;
  category?: string;
  subcategory?: string;
  payment_method?: string;
  total_installments?: string;
  date?: string;
}

/** Result of validating a session: `errors` is keyed by the row's `rowId`. */
export interface SessionValidation {
  hasErrors: boolean;
  errorCount: number;
  errors: Record<string, TransactionErrors>;
}

/** Validates one row against its draft and the available categories. */
function validateRow(
  t: ParsedTransaction,
  draft: RowDraft,
  options: CategorySubcategories | null,
): TransactionErrors {
  const errors: TransactionErrors = {};

  if (!t.description?.trim()) errors.description = 'Descrição é obrigatória';
  if (!t.amount || t.amount <= 0) errors.amount = 'Valor inválido';

  const hasCategory = draft.customCategory ? draft.categoryName?.trim() : t.category_id;
  if (!hasCategory) errors.category = 'Categoria é obrigatória';

  const category = options?.options.find((c) => c.id === t.category_id);
  if (category && category.subcategories.length > 0) {
    const hasSubcategory = draft.customSubcategory ? draft.subcategoryName?.trim() : t.subcategory_id;
    if (!hasSubcategory) errors.subcategory = 'Subcategoria é obrigatória';
  }

  const hasPaymentMethod = draft.customPaymentMethod ? draft.paymentMethodName?.trim() : t.payment_method;
  if (!hasPaymentMethod) errors.payment_method = 'Forma de pagamento é obrigatória';

  if (draft.installment && (draft.totalInstallments || 0) < MIN_INSTALLMENTS) {
    errors.total_installments = 'Mínimo 2 parcelas';
  }

  if (!t.date) errors.date = 'Data é obrigatória';
  return errors;
}

/**
 * Validates every row of a session. A session without a bank fails at once (one error);
 * otherwise `errorCount` is the number of invalid fields across its rows.
 */
export function validateSession(
  session: SessionData,
  drafts: RowDrafts,
  options: CategorySubcategories | null,
): SessionValidation {
  if (!session.bankCode) return { hasErrors: true, errorCount: 1, errors: {} };

  const errors: Record<string, TransactionErrors> = {};
  let errorCount = 0;
  session.transactions.forEach((t) => {
    const rowErrors = validateRow(t, drafts[t.rowId] ?? EMPTY_ROW_DRAFT, options);
    const fieldCount = Object.keys(rowErrors).length;
    if (fieldCount > 0) {
      errors[t.rowId] = rowErrors;
      errorCount += fieldCount;
    }
  });
  return { hasErrors: errorCount > 0, errorCount, errors };
}

/** Rows of a session in the shape `POST /extracts/confirm` expects (typed names win over ids). */
export function buildConfirmTransactions(session: SessionData, drafts: RowDrafts): ConfirmTransaction[] {
  return session.transactions.map((t) => {
    const draft = drafts[t.rowId] ?? EMPTY_ROW_DRAFT;
    const base: ConfirmTransaction = {
      date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.type,
      payment_method: draft.customPaymentMethod ? draft.paymentMethodName : t.payment_method,
      entity_type: t.entity_type,
      bank_code: session.bankCode || undefined,
    };

    if (draft.customCategory) base.category_name = draft.categoryName;
    else base.category_id = t.category_id;

    if (draft.customSubcategory) base.subcategory_name = draft.subcategoryName;
    else base.subcategory_id = t.subcategory_id;

    if (draft.installment) {
      base.total_installments = draft.totalInstallments || DEFAULT_INSTALLMENTS;
      base.is_installment = true;
    }
    return base;
  });
}

/** Counts and totals shown in the summary cards of the review. */
export interface SessionsSummary {
  total: number;
  income: number;
  expense: number;
  totalIncome: number;
  totalExpense: number;
  /** Rows of the sessions that are not confirmed yet. */
  pendingTransactions: number;
}

/** Counts and sums the rows of every session. */
export function summarizeSessions(sessions: SessionData[]): SessionsSummary {
  const summary: SessionsSummary = {
    total: 0,
    income: 0,
    expense: 0,
    totalIncome: 0,
    totalExpense: 0,
    pendingTransactions: 0,
  };
  for (const session of sessions) {
    for (const t of session.transactions) {
      summary.total += 1;
      if (t.type === 'income') {
        summary.income += 1;
        summary.totalIncome += t.amount;
      } else if (t.type === 'expense') {
        summary.expense += 1;
        summary.totalExpense += t.amount;
      }
      if (!session.isConfirmed) summary.pendingTransactions += 1;
    }
  }
  return summary;
}

/** A row of the upload that matches a transaction already in the database. */
export interface DuplicateItem {
  sIdx: number;
  rIdx: number;
  /** The `rowId` of the uploaded row. */
  key: string;
  transaction: ParsedTransaction;
  existing: DuplicateInfo;
  resolved?: 'skip' | 'replace';
}

/** A row of a session with its coordinates, as sent to the duplicate check. */
export interface FlatRow {
  sIdx: number;
  rIdx: number;
  date: string;
  amount: number;
}

/** Every row of every session, in order. The position in the result is the check `index`. */
export function flattenForDuplicateCheck(sessions: SessionData[]): FlatRow[] {
  const flat: FlatRow[] = [];
  sessions.forEach((s, sIdx) => {
    s.transactions.forEach((t, rIdx) => {
      flat.push({ sIdx, rIdx, date: t.date, amount: t.amount });
    });
  });
  return flat;
}

/** Body of `POST /transacoes/check-duplicates` (dates DD/MM/YYYY -> YYYY-MM-DD). */
export function toDuplicateCheckPayload(flat: FlatRow[]) {
  return {
    transactions: flat.map((row, index) => ({
      index,
      transaction_date: row.date.split('/').reverse().join('-'),
      amount: row.amount,
    })),
  };
}

/** One entry of the duplicate check response. */
export interface DuplicateCheckResult {
  index: number;
  has_duplicate: boolean;
  duplicates: DuplicateInfo[];
}

/**
 * Splits the rows with a duplicate (reported with their first match) from the sessions,
 * which come back without them. The input sessions are not changed.
 */
export function splitDuplicates(
  sessions: SessionData[],
  flat: FlatRow[],
  results: DuplicateCheckResult[],
): { dupItems: DuplicateItem[]; cleanSessions: SessionData[] } {
  const dupItems: DuplicateItem[] = [];
  const dupKeys = new Set<string>();

  for (const result of results) {
    if (result.has_duplicate && result.duplicates.length > 0) {
      const row = flat[result.index];
      const transaction = sessions[row.sIdx].transactions[row.rIdx];
      dupKeys.add(transaction.rowId);
      dupItems.push({
        sIdx: row.sIdx,
        rIdx: row.rIdx,
        key: transaction.rowId,
        transaction,
        existing: result.duplicates[0],
      });
    }
  }

  const cleanSessions = sessions.map((s) => ({
    ...s,
    transactions: s.transactions.filter((t) => !dupKeys.has(t.rowId)),
  }));
  return { dupItems, cleanSessions };
}

/** "1 transação" / "3 transações". */
export function formatTransactionCount(count: number): string {
  return `${count} ${count === 1 ? 'transação' : 'transações'}`;
}
