import { describe, it, expect } from 'vitest';
import { categoryLabel, paymentMethodLabel, transactionTypeLabel } from './transactionLabels';

describe('paymentMethodLabel', () => {
  it('translates the known methods to pt-BR', () => {
    expect(paymentMethodLabel('pix')).toBe('Pix');
    expect(paymentMethodLabel('credit')).toBe('Crédito');
    expect(paymentMethodLabel('debit')).toBe('Débito');
    expect(paymentMethodLabel('cash')).toBe('Dinheiro');
    expect(paymentMethodLabel('transfer')).toBe('Transferência');
  });

  it('also translates the Portuguese spellings found in imported data', () => {
    expect(paymentMethodLabel('credito')).toBe('Crédito');
    expect(paymentMethodLabel('boleto')).toBe('Boleto');
  });

  it('keeps a custom method as the user typed it', () => {
    expect(paymentMethodLabel('Vale-refeição')).toBe('Vale-refeição');
  });
});

describe('categoryLabel', () => {
  it('translates the automatic categories and keeps the others', () => {
    expect(categoryLabel('Income')).toBe('Receita');
    expect(categoryLabel('Investments')).toBe('Investimentos');
    expect(categoryLabel('Moradia')).toBe('Moradia');
    expect(categoryLabel(null)).toBe('Sem categoria');
  });
});

describe('transactionTypeLabel', () => {
  it('names the transaction types in pt-BR', () => {
    expect(transactionTypeLabel('income')).toBe('Entrada');
    expect(transactionTypeLabel('expense')).toBe('Saída');
    expect(transactionTypeLabel('investment')).toBe('Investimento');
  });
});
