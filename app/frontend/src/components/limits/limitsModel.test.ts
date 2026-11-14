import { describe, it, expect } from 'vitest';
import {
  buildLimitsPayload,
  limitAlertFor,
  limitStatus,
  transformCategory,
  type Category,
} from './limitsModel';

function cat(overrides: Partial<Category> = {}): Category {
  return { id: 1, name: 'Lazer', entity_type: 'pf', limit: 500, subcategories: [], ...overrides };
}

describe('transformCategory', () => {
  it('maps backend names and entity types to the editable model', () => {
    const result = transformCategory({
      id: 7,
      category_name: 'Moradia',
      entity_type: 'business',
      limit: 10,
      subcategories: [{ id: 1, subcategory_name: 'Aluguel' }],
    });
    expect(result.name).toBe('Moradia');
    expect(result.entity_type).toBe('pj');
    expect(result.subcategories[0].name).toBe('Aluguel');
  });
});

describe('buildLimitsPayload', () => {
  it('sends new categories with backend entity types and only named subcategories', () => {
    const payload = buildLimitsPayload(
      [cat({ id: 'new_1', isNew: true, name: 'Pets', subcategories: [{ id: 'a', name: 'Ração' }, { id: 'b', name: '  ' }] })],
      [],
    );
    expect(payload.new).toEqual([
      { category_name: 'Pets', entity_type: 'individual', limit: 500, subcategories: [{ subcategory_name: 'Ração' }] },
    ]);
    expect(payload.modified).toEqual([]);
  });

  it('sends modified categories with ids, keeping the id of existing subcategories only', () => {
    const payload = buildLimitsPayload(
      [
        cat({
          isModified: true,
          subcategories: [
            { id: 5, name: 'Cinema' },
            { id: 'new_sub', name: 'Jogos', isNew: true },
          ],
        }),
      ],
      [],
    );
    expect(payload.modified).toEqual([
      {
        id: 1,
        category_name: 'Lazer',
        entity_type: 'individual',
        limit: 500,
        subcategories: [{ id: 5, subcategory_name: 'Cinema' }, { subcategory_name: 'Jogos' }],
      },
    ]);
  });

  it('skips a new category that duplicates an existing one (same name and scope)', () => {
    const payload = buildLimitsPayload([cat(), cat({ id: 'new_2', isNew: true, name: ' lazer ' })], []);
    expect(payload.new).toEqual([]);
  });

  it('passes the deleted ids through and ignores untouched categories', () => {
    const payload = buildLimitsPayload([cat()], [9, 10]);
    expect(payload).toEqual({ new: [], modified: [], deleted: [9, 10] });
  });
});

describe('limitAlertFor', () => {
  const spending = { 'lazer|pf': 400 };

  it('returns null below 80% and without a limit or name', () => {
    expect(limitAlertFor(cat({ limit: 1000 }), spending)).toBeNull();
    expect(limitAlertFor(cat({ limit: 0 }), spending)).toBeNull();
    expect(limitAlertFor(cat({ name: ' ' }), spending)).toBeNull();
  });

  it('classifies 80/90/100% as warning/critical/destructive', () => {
    expect(limitAlertFor(cat({ limit: 500 }), spending)?.severity).toBe('warning');
    expect(limitAlertFor(cat({ limit: 430 }), spending)?.severity).toBe('critical');
    expect(limitAlertFor(cat({ limit: 400 }), spending)?.severity).toBe('destructive');
  });
});

describe('limitStatus', () => {
  it('describes the remaining or exceeded amount for a card', () => {
    expect(limitStatus({ limit: 2500, spent: 1850, remaining: 650, percent_used: 74 })).toEqual({
      kind: 'remaining',
      amount: 650,
      percent: 74,
      tone: 'warning',
    });
    expect(limitStatus({ limit: 3500, spent: 5865, remaining: -2365, percent_used: 167.6 })).toEqual({
      kind: 'over',
      amount: 2365,
      percent: 100,
      tone: 'destructive',
    });
    expect(limitStatus({ limit: 400, spent: 150, remaining: 250, percent_used: 37.5 }).tone).toBe('ok');
  });
});
