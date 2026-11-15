import { describe, it, expect } from 'vitest';
import { addMonths, toYearMonth } from './months';

describe('addMonths', () => {
  it('rolls over year boundaries in both directions', () => {
    expect(addMonths({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(addMonths({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
    expect(addMonths({ year: 2026, month: 11 }, 0)).toEqual({ year: 2026, month: 11 });
  });
});

describe('toYearMonth', () => {
  it('maps a date to its calendar month (1-12)', () => {
    expect(toYearMonth(new Date(2026, 10, 14))).toEqual({ year: 2026, month: 11 });
  });
});
