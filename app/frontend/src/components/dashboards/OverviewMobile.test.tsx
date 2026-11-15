import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { OverviewMobile } from './OverviewMobile';
import type { OverviewResponse } from '@/types/overview';

const recurring = (id: number, description: string, amount: number, dueDay: number) => ({
  id,
  description,
  amount,
  due_day: dueDay,
  category_name: 'Moradia',
  subcategory_name: 'Aluguel',
  entity_type: 'individual' as const,
  payment_method: 'pix',
  current_installment: 3,
  total_installments: 12,
  remaining_installments: 9,
  is_ending_soon: false,
});

const category = (id: number, name: string, percent: number, status: 'ok' | 'warning' | 'over') => ({
  id,
  category_name: name,
  entity_type: 'individual' as const,
  limit: 1000,
  spent: percent * 10,
  remaining: 1000 - percent * 10,
  percent_used: percent,
  status,
});

const DATA: OverviewResponse = {
  reference_month: '11/2026',
  entity_type: 'all',
  totals: { total_income: 10120, total_expenses: 8879.5, total_invested: 200, balance: 1240.5 },
  month_progress: { day: 14, days_in_month: 30, percent: 0.47, income_up_to_today: 5000, expenses_up_to_today: 900, balance: 1600 },
  credit_card: { limit: 45000, used: 3200, remaining: 41800, percent_used: 7 },
  categories_status: [
    category(1, 'Financiamentos', 74, 'warning'),
    category(2, 'Moradia', 168, 'over'),
    category(3, 'Lazer', 90, 'warning'),
    category(4, 'Saúde', 85, 'warning'),
  ],
  installments: [],
  recurring_accounts: [
    recurring(1, 'Aluguel', 2200, 20),
    recurring(2, 'Internet', 120, 22),
    recurring(3, 'Luz', 280, 15),
    recurring(4, 'Água', 120, 18),
  ],
  goals: [1, 2, 3, 4].map((n) => ({
    subcategory_id: n,
    subcategory_name: `Meta ${n}`,
    target_amount: 1000,
    current_amount: 100,
    progress: 10,
    completed: false,
    completed_at: null,
    entity_type: 'individual' as const,
  })),
  shopping: [1, 2, 3, 4].map((n) => ({
    id: n,
    name: `Item ${n}`,
    reference_month: '2026-11-01',
    checked: false,
    completed_at: null,
    entity_type: 'individual' as const,
  })),
};

function renderMobile(overrides: Partial<React.ComponentProps<typeof OverviewMobile>> = {}) {
  const props = {
    data: DATA,
    entityType: 'all' as const,
    onEntityTypeChange: vi.fn(),
    isAdmin: false,
    ...overrides,
  };
  render(
    <MemoryRouter>
      <OverviewMobile {...props} />
    </MemoryRouter>,
  );
  return props;
}

describe('OverviewMobile', () => {
  it('shows the month balance in a hero card with income and expenses', () => {
    renderMobile();
    const hero = screen.getByTestId('hero-balance');
    expect(hero.textContent).toContain('Saldo do mês');
    expect(hero.textContent).toMatch(/R\$\s1\.240,50/);
    expect(hero.textContent).toMatch(/Entradas\s*R\$\s10\.120,00/);
    expect(hero.textContent).toMatch(/Saídas\s*R\$\s8\.879,50/);
  });

  it('shows the month progress with the card usage', () => {
    renderMobile();
    const card = screen.getByTestId('month-progress');
    expect(card.textContent).toContain('Dia 14 de 30');
    expect(card.textContent).toContain('47%');
    expect(card.textContent).toMatch(/Cartão: R\$\s3\.200,00 de R\$\s45\.000,00/);
  });

  it('lists the 3 categories closest to the limit, worst first, linking to /limits', () => {
    renderMobile();
    const card = screen.getByTestId('near-limit');
    const names = within(card)
      .getAllByRole('listitem')
      .map((li) => li.textContent);
    expect(names).toHaveLength(3);
    expect(names[0]).toContain('Moradia');
    expect(names[0]).toContain('168%');
    expect(names[1]).toContain('Lazer');
    expect(names[2]).toContain('Saúde');
    expect(within(card).getByRole('link', { name: 'Ver limites' }).getAttribute('href')).toBe('/limits');
  });

  it('hides the near-limit card when nothing is close to the limit', () => {
    renderMobile({ data: { ...DATA, categories_status: [] } });
    expect(screen.queryByTestId('near-limit')).toBeNull();
  });

  it('caps "A pagar este mês" at 3 items and expands with Ver tudo', () => {
    renderMobile();
    const card = screen.getByTestId('to-pay');
    expect(within(card).getAllByRole('listitem')).toHaveLength(3);
    expect(card.textContent).toContain('vence 20/11');

    fireEvent.click(within(card).getByRole('button', { name: 'Ver tudo' }));
    expect(within(card).getAllByRole('listitem')).toHaveLength(4);
    fireEvent.click(within(card).getByRole('button', { name: 'Ver menos' }));
    expect(within(card).getAllByRole('listitem')).toHaveLength(3);
  });

  it('shows goals and shopping only for admins, capped at 3 with Ver tudo', () => {
    renderMobile();
    expect(screen.queryByTestId('goals')).toBeNull();
    expect(screen.queryByTestId('shopping')).toBeNull();
  });

  it('caps goals and shopping for admins', () => {
    renderMobile({ isAdmin: true });
    const goals = screen.getByTestId('goals');
    const shopping = screen.getByTestId('shopping');
    expect(within(goals).getAllByRole('listitem')).toHaveLength(3);
    expect(within(shopping).getAllByRole('listitem')).toHaveLength(3);
    fireEvent.click(within(shopping).getByRole('button', { name: 'Ver tudo' }));
    expect(within(shopping).getAllByRole('listitem')).toHaveLength(4);
  });

  it('switches the scope with the Ambos/PF/PJ segmented control', () => {
    const props = renderMobile();
    expect(screen.getByRole('radio', { name: 'Ambos' }).getAttribute('aria-checked')).toBe('true');
    fireEvent.click(screen.getByRole('radio', { name: 'PJ' }));
    expect(props.onEntityTypeChange).toHaveBeenCalledWith('pj');
  });
});
