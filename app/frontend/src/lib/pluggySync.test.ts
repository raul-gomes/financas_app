import { describe, it, expect } from 'vitest';
import { formatSyncSummary } from './pluggySync';

const base = { message: '5 transações importadas de 2 contas.', imported: 5, skipped: 0, linked: 0 };

describe('formatSyncSummary', () => {
  it('keeps the server message when nothing was skipped', () => {
    expect(formatSyncSummary(base)).toBe('5 transações importadas de 2 contas.');
  });

  it('adds how many were already in the app', () => {
    expect(formatSyncSummary({ ...base, skipped: 30 })).toBe(
      '5 transações importadas de 2 contas. 30 já estavam no app.',
    );
    expect(formatSyncSummary({ ...base, skipped: 1 })).toBe(
      '5 transações importadas de 2 contas. 1 já estava no app.',
    );
  });

  it('adds how many existing entries were linked to the bank', () => {
    expect(formatSyncSummary({ ...base, skipped: 30, linked: 8 })).toBe(
      '5 transações importadas de 2 contas. 30 já estavam no app (8 vinculadas a lançamentos existentes).',
    );
    expect(formatSyncSummary({ ...base, skipped: 1, linked: 1 })).toBe(
      '5 transações importadas de 2 contas. 1 já estava no app (1 vinculada a lançamento existente).',
    );
  });
});
