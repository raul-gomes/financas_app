import { describe, it, expect } from 'vitest';
import { buildRecentMonths, recentMonthYears } from './recentMonths';

const months = (values: number[]) =>
  Object.fromEntries(
    ['janeiro', 'fevereiro', 'marco', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'].map(
      (name, idx) => [
        name,
        // Outflows = expenses + investments (10 invested every month).
        { income: values[idx] ?? 0, expense: (values[idx] ?? 0) / 2, outflows: (values[idx] ?? 0) / 2 + 10 },
      ],
    ),
  );

describe('recentMonthYears', () => {
  it('needs only the end year when the window stays inside it', () => {
    expect(recentMonthYears({ year: 2026, month: 11 }, 6)).toEqual([2026]);
  });

  it('also needs the previous year when the window crosses the new year', () => {
    expect(recentMonthYears({ year: 2026, month: 3 }, 6)).toEqual([2026, 2025]);
  });
});

describe('buildRecentMonths', () => {
  const nov2026 = { year: 2026, month: 11 };

  it('returns the last 6 months ending at the given month, oldest first', () => {
    const result = buildRecentMonths(nov2026, 6, {
      2026: { limit: 0, months: months([100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]) },
    });
    expect(result.map((m) => m.label)).toEqual(['jun', 'jul', 'ago', 'set', 'out', 'nov']);
    expect(result[0]).toMatchObject({ year: 2026, month: 6, income: 600, outflows: 310 });
    expect(result[5]).toMatchObject({ year: 2026, month: 11, income: 1100, outflows: 560 });
  });

  it('reads the previous year for months before January', () => {
    const result = buildRecentMonths({ year: 2026, month: 2 }, 6, {
      2026: { limit: 0, months: months([10, 20]) },
      2025: { limit: 0, months: months([0, 0, 0, 0, 0, 0, 0, 0, 90, 100, 110, 120]) },
    });
    expect(result.map((m) => `${m.label}/${m.year}`)).toEqual([
      'set/2025',
      'out/2025',
      'nov/2025',
      'dez/2025',
      'jan/2026',
      'fev/2026',
    ]);
    expect(result[3].income).toBe(120);
    expect(result[5].income).toBe(20);
  });

  it('uses zero for months whose year has not loaded yet', () => {
    const result = buildRecentMonths({ year: 2026, month: 2 }, 6, { 2026: { limit: 0, months: months([10, 20]) } });
    expect(result[0]).toMatchObject({ income: 0, outflows: 0 });
  });
});
