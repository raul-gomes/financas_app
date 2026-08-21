import { describe, expect, it } from 'vitest';
import { DEFAULT_CURRENCY, formatCurrency, formatDate, formatPercent } from './format';

describe('formatCurrency', () => {
  it('formata em BRL por padrão com locale en-US', () => {
    expect(formatCurrency(1234.56)).toBe('R$1,234.56');
  });

  it('aceita moeda alternativa sem mudar call sites', () => {
    expect(formatCurrency(1234.56, 'USD')).toBe('$1,234.56');
  });

  it('valores negativos e zero', () => {
    expect(formatCurrency(-0.5)).toContain('-');
    expect(formatCurrency(0)).toBe(`${Intl.NumberFormat('en-US', { style: 'currency', currency: DEFAULT_CURRENCY }).format(0)}`);
  });
});

describe('formatDate', () => {
  it('não sofre deslocamento de fuso em data pura', () => {
    expect(formatDate('2026-08-21')).toBe('8/21/2026');
  });

  it('aceita ISO completo', () => {
    expect(formatDate('2026-01-02T03:04:05')).toMatch(/^1\/\d/);
  });
});

describe('formatPercent', () => {
  it('arredonda para 2 casas por padrão', () => {
    expect(formatPercent(12.345)).toBe('12.35%');
  });

  it('respeita dígitos customizados', () => {
    expect(formatPercent(12.345, 1)).toBe('12.3%');
  });
});
