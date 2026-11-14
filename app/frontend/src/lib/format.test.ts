import { describe, expect, it } from 'vitest';
import {
  formatCompactNumber,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
} from './format';

// pt-BR currency uses a no-break space (U+00A0) between the symbol and the digits.
const NBSP = ' ';

describe('formatCurrency', () => {
  it('formats BRL in pt-BR by default', () => {
    expect(formatCurrency(5865)).toBe(`R$${NBSP}5.865,00`);
    expect(formatCurrency(1234.56)).toBe(`R$${NBSP}1.234,56`);
  });

  it('accepts an alternative currency without changing call sites', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe(`US$${NBSP}1.234,56`);
  });

  it('handles negative values and zero', () => {
    expect(formatCurrency(-0.5)).toBe(`-R$${NBSP}0,50`);
    expect(formatCurrency(0)).toBe(`R$${NBSP}0,00`);
  });
});

describe('formatNumber', () => {
  it('uses pt-BR separators and default fraction digits', () => {
    expect(formatNumber(1234567.891)).toBe('1.234.567,891');
  });

  it('respects fixed fraction digits', () => {
    expect(formatNumber(1234.5, { minimumFractionDigits: 2, maximumFractionDigits: 2 })).toBe('1.234,50');
  });
});

describe('formatCompactNumber', () => {
  it('abbreviates thousands in pt-BR', () => {
    expect(formatCompactNumber(5000)).toBe(`5${NBSP}mil`);
  });
});

describe('formatDate', () => {
  it('does not shift a plain date because of the time zone', () => {
    expect(formatDate('2026-08-21')).toBe('21/08/2026');
  });

  it('accepts a full ISO string', () => {
    expect(formatDate('2026-01-02T03:04:05')).toBe('02/01/2026');
  });
});

describe('formatPercent', () => {
  it('rounds to 2 decimals by default using a decimal comma', () => {
    expect(formatPercent(12.345)).toBe('12,35%');
  });

  it('respects custom digits', () => {
    expect(formatPercent(12.345, 1)).toBe('12,3%');
    expect(formatPercent(47, 0)).toBe('47%');
  });
});
