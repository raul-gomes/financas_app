import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { OverviewDashboard } from './OverviewDashboard';
import { OverviewResponse } from '@/types/overview';

const mockGetOverview = vi.fn();

vi.mock('@/services/overviewService', () => ({
  OverviewService: {
    getOverview: (...args: unknown[]) => mockGetOverview(...args),
  },
}));

const baseOverview: OverviewResponse = {
  reference_month: '09/2026',
  entity_type: 'all',
  totals: { total_income: 5000, total_expenses: 3200, total_invested: 200, balance: 1800 },
  month_progress: {
    day: 12,
    days_in_month: 30,
    percent: 0.4,
    income_up_to_today: 2500,
    expenses_up_to_today: 900,
    balance: 1600,
  },
  credit_card: { limit: 10000, used: 3000, remaining: 7000, percent_used: 30 },
  categories_status: [
    { id: 1, category_name: 'Lazer', entity_type: 'individual', limit: 1000, spent: 900, remaining: 100, percent_used: 90, status: 'warning' },
    { id: 2, category_name: 'Compras', entity_type: 'individual', limit: 1000, spent: 1200, remaining: -200, percent_used: 120, status: 'over' },
  ],
  installments: [
    {
      id: 10,
      description: 'Notebook - parcela 1/10',
      amount: 500,
      installment_number: 1,
      total_installments: 10,
      category_name: 'Eletro',
      subcategory_name: 'Notebook',
      payment_method: 'credit',
      entity_type: 'individual',
      transaction_date: '2026-09-10T00:00:00',
    },
  ],
  recurring_accounts: [
    {
      id: 3,
      description: 'Assinatura Netflix',
      amount: 50,
      due_day: 5,
      category_name: 'Lazer',
      subcategory_name: 'Streaming',
      entity_type: 'individual',
      payment_method: 'pix',
      current_installment: 9,
      total_installments: 12,
      remaining_installments: 4,
      is_ending_soon: false,
    },
  ],
  goals: [{ subcategory_id: 1, subcategory_name: 'Eurotrip', target_amount: 50000, current_amount: 12000, progress: 24, completed: false, completed_at: null, entity_type: 'individual' }],
  shopping: [{ id: 1, name: 'Notebook', reference_month: '2026-09-01', checked: false, completed_at: null, entity_type: 'individual' }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOverview.mockResolvedValue(baseOverview);
});

describe('OverviewDashboard', () => {
  it('renderiza indicadores principais, progresso do mês e cartão', async () => {
    render(<OverviewDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Entradas")).toBeTruthy();
    });
    expect(screen.getByText('R$3,200.00')).toBeTruthy();
    expect(screen.getByText('R$1,800.00')).toBeTruthy();
    expect(screen.getAllByText('30%').length).toBeGreaterThan(0);
  });

  it('destaca categorias com limite estourado ou para estourar', async () => {
    render(<OverviewDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Compras')).toBeTruthy();
    });
    expect(screen.getByText('Estourado')).toBeTruthy();
    expect(screen.getByText('Para estourar')).toBeTruthy();
  });

  it('lista parcelas do mês e contas recorrentes a pagar', async () => {
    render(<OverviewDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Notebook - parcela 1\/10/)).toBeTruthy();
    });
    expect(screen.getByText(/Assinatura Netflix/)).toBeTruthy();
    expect(screen.getByText(/9\/12/)).toBeTruthy();
  });

  it('mostra metas e compras quando admin', async () => {
    render(<OverviewDashboard isAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Eurotrip')).toBeTruthy();
    });
    expect(screen.getByText('Notebook')).toBeTruthy();
  });

  it('esconde metas e compras quando não-admin', async () => {
    render(<OverviewDashboard isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText("Entradas")).toBeTruthy();
    });
    expect(screen.queryByText('Eurotrip')).toBeNull();
    expect(screen.queryByText('Notebook')).toBeNull();
  });

  it('refaz o fetch ao trocar o entity_type', async () => {
    const { getByRole } = render(<OverviewDashboard />);

    await waitFor(() => {
      expect(mockGetOverview.mock.calls.length).toBeGreaterThan(0);
    });
    const callsBefore = mockGetOverview.mock.calls.length;

    fireEvent.click(getByRole('button', { name: 'PJ' }));

    await waitFor(() => {
      expect(mockGetOverview.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('mostra badge "Estourando" no cartão quando passa do limite', async () => {
    mockGetOverview.mockResolvedValue({
      ...baseOverview,
      credit_card: { limit: 10000, used: 11500, remaining: -1500, percent_used: 115 },
    });

    render(<OverviewDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Estourando')).toBeTruthy();
    });
    expect(screen.getByText('115%')).toBeTruthy();
  });

  it('cartão em 85% é destacado como warning (próximo do limite)', async () => {
    mockGetOverview.mockResolvedValue({
      ...baseOverview,
      credit_card: { limit: 10000, used: 8500, remaining: 1500, percent_used: 85 },
    });

    render(<OverviewDashboard />);

    await waitFor(() => {
      expect(screen.getByText('85%')).toBeTruthy();
    });
    expect(screen.queryByText('Estourando')).toBeNull();
  });
});