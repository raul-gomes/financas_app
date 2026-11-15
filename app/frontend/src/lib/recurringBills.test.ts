import { describe, expect, it } from 'vitest';
import { currentInstallment, isEndingSoon } from './recurringBills';
import type { ContaRecorrente } from '@/types/recurringAccount';

function conta(overrides: Partial<ContaRecorrente>): ContaRecorrente {
  return {
    id: 1,
    description: 'Netflix',
    amount: 50,
    due_day: 10,
    entity_type: 'individual',
    payment_method: 'credito',
    bank_code: null,
    current_installment: 1,
    is_ending_soon: false,
    category_id: 1,
    subcategory_id: 1,
    category_name: 'Lazer',
    subcategory_name: 'Streaming',
    start_date: '2026-01-01',
    end_date: null,
    total_installments: 12,
    remaining_installments: 12,
    active: true,
    ...overrides,
  };
}

describe('currentInstallment', () => {
  it('is total minus remaining plus one', () => {
    expect(currentInstallment(conta({ remaining_installments: 8 }))).toBe(5);
  });

  it('stays between 1 and the total', () => {
    expect(currentInstallment(conta({ remaining_installments: 20 }))).toBe(1);
    expect(currentInstallment(conta({ remaining_installments: 0 }))).toBe(12);
  });
});

describe('isEndingSoon', () => {
  it('flags active accounts from the 10th installment on', () => {
    expect(isEndingSoon(conta({ remaining_installments: 3 }))).toBe(true);
    expect(isEndingSoon(conta({ remaining_installments: 4 }))).toBe(false);
  });

  it('ignores inactive or finished accounts', () => {
    expect(isEndingSoon(conta({ remaining_installments: 3, active: false }))).toBe(false);
    expect(isEndingSoon(conta({ remaining_installments: 0 }))).toBe(false);
  });
});
