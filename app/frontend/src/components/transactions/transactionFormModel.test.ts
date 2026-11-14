import { describe, it, expect } from 'vitest';
import {
  brToIso,
  emptyFormValues,
  installmentValue,
  isIsoDate,
  isKnownPaymentMethod,
  isoToBr,
  maskDateBR,
  valuesFromTransaction,
} from './transactionFormModel';
import type { Transaction } from '@/types/financial';

const TODAY = new Date(2026, 10, 14);

describe('date helpers', () => {
  it('masks typed digits as dd/mm/aaaa', () => {
    expect(maskDateBR('1411')).toBe('14/11');
    expect(maskDateBR('14112026999')).toBe('14/11/2026');
  });

  it('converts between dd/mm/aaaa and ISO, rejecting impossible dates', () => {
    expect(brToIso('14/11/2026')).toBe('2026-11-14');
    expect(brToIso('31/02/2026')).toBe('');
    expect(brToIso('14/11')).toBe('');
    expect(isoToBr('2026-11-14')).toBe('14/11/2026');
    expect(isIsoDate('2026-11-14')).toBe(true);
    expect(isIsoDate('')).toBe(false);
  });
});

describe('emptyFormValues', () => {
  it('starts as a cash expense of today for the individual scope', () => {
    expect(emptyFormValues(TODAY)).toEqual({
      type: 'expense',
      amount: '',
      description: '',
      category_name: '',
      subcategory_name: '',
      transaction_date: '2026-11-14',
      payment_method: 'cash',
      total_installments: null,
      entity_type: 'individual',
    });
  });
});

describe('valuesFromTransaction', () => {
  const t: Transaction = {
    id: 5,
    type: 'income',
    amount: 10120.5,
    description: 'Salário',
    category_id: 1,
    subcategory_id: 2,
    category_name: 'Income',
    subcategory_name: 'Salário',
    payment_method: 'pix',
    installment_number: 1,
    total_installments: 12,
    is_installment: true,
    bank_code: '260',
    entity_type: 'business',
    transaction_date: '2026-11-12T00:00:00',
    recurring_account_id: null,
  };

  it('maps a transaction to the editable form values', () => {
    expect(valuesFromTransaction(t)).toEqual({
      type: 'income',
      amount: '10120.5',
      description: 'Salário',
      category_name: 'Income',
      subcategory_name: 'Salário',
      transaction_date: '2026-11-12',
      payment_method: 'pix',
      total_installments: '12',
      entity_type: 'business',
    });
  });

  it('keeps null installments and a missing category as empty strings', () => {
    const values = valuesFromTransaction({ ...t, total_installments: null, category_name: null, subcategory_name: null });
    expect(values.total_installments).toBeNull();
    expect(values.category_name).toBe('');
    expect(values.subcategory_name).toBe('');
  });
});

describe('payment methods and installments', () => {
  it('recognizes the built-in payment methods', () => {
    expect(isKnownPaymentMethod('pix')).toBe(true);
    expect(isKnownPaymentMethod('Vale-refeição')).toBe(false);
  });

  it('divides the amount by the number of installments, or returns null when not applicable', () => {
    expect(installmentValue(true, '1200', '12')).toBe(100);
    expect(installmentValue(false, '1200', '12')).toBeNull();
    expect(installmentValue(true, '', '12')).toBeNull();
    expect(installmentValue(true, '1200', '0')).toBeNull();
    expect(installmentValue(true, '1200', null)).toBeNull();
  });
});
