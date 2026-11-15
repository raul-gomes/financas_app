import { describe, it, expect } from 'vitest';
import type { ParsedTransaction, SessionData } from '@/types/extract';
import type { CategorySubcategories } from '@/types/financial';
import {
  EMPTY_ROW_DRAFT,
  OTHER_OPTION,
  buildConfirmTransactions,
  changeCategory,
  changePaymentMethod,
  changeSubcategory,
  flattenForDuplicateCheck,
  formatTransactionCount,
  nextRowId,
  parseTotalInstallments,
  splitDuplicates,
  summarizeSessions,
  toDuplicateCheckPayload,
  toggleInstallment,
  typeCategoryName,
  typePaymentMethodName,
  typeSubcategoryName,
  validateSession,
  type RowDrafts,
} from './extractReview';

const categories: CategorySubcategories = {
  options: [
    { id: 1, name: 'Alimentacao', type: 'expense', subcategories: [{ id: 11, name: 'Mercado' }] },
    { id: 3, name: 'Vazia', type: 'expense', subcategories: [] },
  ],
};

function tx(overrides: Partial<ParsedTransaction> = {}): ParsedTransaction {
  return {
    rowId: 'r1',
    date: '15/03/2026',
    description: 'Mercado',
    amount: 100,
    type: 'expense',
    payment_method: 'pix',
    entity_type: 'individual',
    category_id: 1,
    subcategory_id: 11,
    ...overrides,
  };
}

function session(transactions: ParsedTransaction[], overrides: Partial<SessionData> = {}): SessionData {
  return { filename: 'a.csv', bankCode: '260', isConfirmed: false, transactions, ...overrides };
}

describe('nextRowId', () => {
  it('hands out a different id every time', () => {
    expect(nextRowId()).not.toBe(nextRowId());
  });
});

describe('row change builders', () => {
  it('picking "Outros..." as payment method opens the free text and clears the value', () => {
    expect(changePaymentMethod(OTHER_OPTION)).toEqual({
      draft: { customPaymentMethod: true },
      transaction: { payment_method: '' },
    });
  });

  it('picking a known payment method closes the free text and forgets the typed name', () => {
    expect(changePaymentMethod('pix')).toEqual({
      draft: { customPaymentMethod: false, paymentMethodName: '' },
      transaction: { payment_method: 'pix' },
    });
  });

  it('typing a payment method name keeps it on the row too', () => {
    expect(typePaymentMethodName('vale')).toEqual({
      draft: { paymentMethodName: 'vale' },
      transaction: { payment_method: 'vale' },
    });
  });

  it('picking "Outros..." as category opens the free text and clears category and subcategory', () => {
    const change = changeCategory(OTHER_OPTION, categories);
    expect(change.draft).toEqual({ customCategory: true });
    expect(change.transaction).toEqual({ category_id: undefined, subcategory_id: undefined });
    expect(Object.keys(change.transaction)).toEqual(['category_id', 'subcategory_id']);
  });

  it('picking a category selects its first subcategory', () => {
    expect(changeCategory('1', categories)).toEqual({
      draft: { customCategory: false, categoryName: '' },
      transaction: { category_id: 1, subcategory_id: 11 },
    });
  });

  it('picking a category without subcategories leaves the subcategory empty', () => {
    expect(changeCategory('3', categories).transaction).toEqual({ category_id: 3, subcategory_id: undefined });
  });

  it('picking a category before the options load still sets the id', () => {
    expect(changeCategory('1', null).transaction).toEqual({ category_id: 1, subcategory_id: undefined });
  });

  it('typing a new category name clears the category id', () => {
    expect(typeCategoryName('Pets')).toEqual({
      draft: { categoryName: 'Pets' },
      transaction: { category_id: undefined },
    });
  });

  it('subcategory: "Outros..." opens the free text, a value picks the id, typing clears the id', () => {
    expect(changeSubcategory(OTHER_OPTION)).toEqual({
      draft: { customSubcategory: true },
      transaction: { subcategory_id: undefined },
    });
    expect(changeSubcategory('11')).toEqual({
      draft: { customSubcategory: false, subcategoryName: '' },
      transaction: { subcategory_id: 11 },
    });
    expect(typeSubcategoryName('Ração')).toEqual({
      draft: { subcategoryName: 'Ração' },
      transaction: { subcategory_id: undefined },
    });
  });
});

describe('installments', () => {
  it('turning installments on defaults to 2, keeping a previous total', () => {
    expect(toggleInstallment(EMPTY_ROW_DRAFT, true)).toEqual({ installment: true, totalInstallments: 2 });
    expect(toggleInstallment({ ...EMPTY_ROW_DRAFT, totalInstallments: 6 }, true)).toEqual({
      installment: true,
      totalInstallments: 6,
    });
  });

  it('turning installments off keeps the total untouched', () => {
    expect(toggleInstallment({ ...EMPTY_ROW_DRAFT, installment: true, totalInstallments: 4 }, false)).toEqual({
      installment: false,
      totalInstallments: 4,
    });
  });

  it('parses the typed total, falling back to 2 when it is not a number', () => {
    expect(parseTotalInstallments('12')).toBe(12);
    expect(parseTotalInstallments('')).toBe(2);
    expect(parseTotalInstallments('abc')).toBe(2);
  });
});

describe('validateSession', () => {
  it('fails at once when the session has no bank', () => {
    const result = validateSession(session([tx()], { bankCode: '' }), {}, categories);
    expect(result).toEqual({ hasErrors: true, errorCount: 1, errors: {} });
  });

  it('passes a complete row', () => {
    expect(validateSession(session([tx()]), {}, categories)).toEqual({
      hasErrors: false,
      errorCount: 0,
      errors: {},
    });
  });

  it('counts every missing field per row, keyed by the row key', () => {
    const bad = tx({ rowId: 'bad', description: '  ', amount: 0, category_id: undefined, subcategory_id: undefined, payment_method: '', date: '' });
    const result = validateSession(session([tx(), bad]), {}, categories);
    expect(result.hasErrors).toBe(true);
    expect(Object.keys(result.errors)).toEqual(['bad']);
    expect(result.errors['bad']).toEqual({
      description: 'Descrição é obrigatória',
      amount: 'Valor inválido',
      category: 'Categoria é obrigatória',
      payment_method: 'Forma de pagamento é obrigatória',
      date: 'Data é obrigatória',
    });
    expect(result.errorCount).toBe(5);
  });

  it('requires a subcategory only when the chosen category has some', () => {
    const noSub = tx({ subcategory_id: undefined });
    expect(validateSession(session([noSub]), {}, categories).errors['r1']).toEqual({
      subcategory: 'Subcategoria é obrigatória',
    });
    const emptyCategory = tx({ category_id: 3, subcategory_id: undefined });
    expect(validateSession(session([emptyCategory]), {}, categories).hasErrors).toBe(false);
  });

  it('accepts typed names instead of ids and rejects blank ones', () => {
    const row = tx({ category_id: undefined, subcategory_id: undefined, payment_method: '' });
    const filled: RowDrafts = {
      'r1': {
        ...EMPTY_ROW_DRAFT,
        customCategory: true,
        categoryName: 'Pets',
        customPaymentMethod: true,
        paymentMethodName: 'vale',
      },
    };
    expect(validateSession(session([row]), filled, categories).hasErrors).toBe(false);
    const blank: RowDrafts = {
      'r1': { ...EMPTY_ROW_DRAFT, customCategory: true, categoryName: '   ', customPaymentMethod: true, paymentMethodName: '' },
    };
    const result = validateSession(session([row]), blank, categories);
    expect(result.errors['r1']).toEqual({
      category: 'Categoria é obrigatória',
      payment_method: 'Forma de pagamento é obrigatória',
    });
  });

  it('requires at least 2 installments when the row is installment-based', () => {
    const drafts: RowDrafts = { 'r1': { ...EMPTY_ROW_DRAFT, installment: true, totalInstallments: 1 } };
    expect(validateSession(session([tx()]), drafts, categories).errors['r1']).toEqual({
      total_installments: 'Mínimo 2 parcelas',
    });
  });

  it('keys the errors by the row id, not by its position', () => {
    const result = validateSession(session([tx({ rowId: 'first' }), tx({ rowId: 'second', description: '' })]), {}, categories);
    expect(Object.keys(result.errors)).toEqual(['second']);
  });
});

describe('buildConfirmTransactions', () => {
  it('maps rows to the confirm payload with the session bank', () => {
    expect(buildConfirmTransactions(session([tx()]), {})).toEqual([
      {
        date: '15/03/2026',
        description: 'Mercado',
        amount: 100,
        type: 'expense',
        payment_method: 'pix',
        entity_type: 'individual',
        bank_code: '260',
        category_id: 1,
        subcategory_id: 11,
      },
    ]);
  });

  it('omits the bank when the session has none', () => {
    const [row] = buildConfirmTransactions(session([tx()], { bankCode: '' }), {});
    expect(row.bank_code).toBeUndefined();
  });

  it('sends typed names instead of ids, and the installment data', () => {
    const drafts: RowDrafts = {
      'r1': {
        ...EMPTY_ROW_DRAFT,
        customCategory: true,
        categoryName: 'Pets',
        customSubcategory: true,
        subcategoryName: 'Ração',
        customPaymentMethod: true,
        paymentMethodName: 'vale',
        installment: true,
        totalInstallments: 3,
      },
    };
    const [row] = buildConfirmTransactions(session([tx()]), drafts);
    expect(row).toMatchObject({
      category_name: 'Pets',
      subcategory_name: 'Ração',
      payment_method: 'vale',
      total_installments: 3,
      is_installment: true,
    });
    expect(row).not.toHaveProperty('category_id');
    expect(row).not.toHaveProperty('subcategory_id');
  });

  it('defaults the installments to 2 when the total is missing', () => {
    const drafts: RowDrafts = { 'r1': { ...EMPTY_ROW_DRAFT, installment: true } };
    expect(buildConfirmTransactions(session([tx()]), drafts)[0].total_installments).toBe(2);
  });
});

describe('summarizeSessions', () => {
  it('counts rows and sums amounts per direction across sessions', () => {
    const totals = summarizeSessions([
      session([tx({ amount: 10 }), tx({ type: 'income', amount: 100 })]),
      session([tx({ amount: 5 })], { isConfirmed: true }),
    ]);
    expect(totals).toEqual({
      total: 3,
      income: 1,
      expense: 2,
      totalIncome: 100,
      totalExpense: 15,
      pendingTransactions: 2,
    });
  });

  it('is all zeros without sessions', () => {
    expect(summarizeSessions([])).toEqual({
      total: 0,
      income: 0,
      expense: 0,
      totalIncome: 0,
      totalExpense: 0,
      pendingTransactions: 0,
    });
  });
});

describe('duplicate detection helpers', () => {
  const sessions = [
    session([
      tx({ rowId: 'a', date: '01/02/2026', amount: 1 }),
      tx({ rowId: 'b', date: '02/02/2026', amount: 2 }),
    ]),
    session([tx({ rowId: 'c', date: '03/02/2026', amount: 3 })]),
  ];

  it('flattens every row with its coordinates and builds the ISO payload', () => {
    const flat = flattenForDuplicateCheck(sessions);
    expect(flat.map((r) => [r.sIdx, r.rIdx])).toEqual([
      [0, 0],
      [0, 1],
      [1, 0],
    ]);
    expect(toDuplicateCheckPayload(flat)).toEqual({
      transactions: [
        { index: 0, transaction_date: '2026-02-01', amount: 1 },
        { index: 1, transaction_date: '2026-02-02', amount: 2 },
        { index: 2, transaction_date: '2026-02-03', amount: 3 },
      ],
    });
  });

  it('moves the rows with a duplicate out of the sessions, keeping the first match', () => {
    const flat = flattenForDuplicateCheck(sessions);
    const existing = (id: number) => ({
      id,
      description: 'old',
      amount: 1,
      transaction_date: '2026-02-01',
      type: 'expense',
      entity_type: 'individual',
    });
    const { dupItems, cleanSessions } = splitDuplicates(sessions, flat, [
      { index: 0, has_duplicate: false, duplicates: [] },
      { index: 1, has_duplicate: true, duplicates: [existing(7), existing(8)] },
      { index: 2, has_duplicate: true, duplicates: [] },
    ]);
    expect(dupItems).toHaveLength(1);
    expect(dupItems[0]).toMatchObject({ sIdx: 0, rIdx: 1, key: 'b', existing: { id: 7 } });
    expect(dupItems[0].transaction).toBe(sessions[0].transactions[1]);
    expect(cleanSessions[0].transactions).toHaveLength(1);
    expect(cleanSessions[1].transactions).toHaveLength(1);
    expect(sessions[0].transactions).toHaveLength(2);
  });
});

describe('formatTransactionCount', () => {
  it('uses the singular for exactly one', () => {
    expect(formatTransactionCount(1)).toBe('1 transação');
  });
  it('uses the plural otherwise', () => {
    expect(formatTransactionCount(0)).toBe('0 transações');
    expect(formatTransactionCount(2)).toBe('2 transações');
  });
});
