import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { renderWithQuery } from '@/test/queryWrapper';
import { OverviewDashboard } from './OverviewDashboard';
import { OverviewResponse } from '@/types/overview';

const mockGetOverview = vi.fn();

vi.mock('@/services/overviewService', () => ({
  OverviewService: {
    getOverview: (...args: unknown[]) => mockGetOverview(...args),
  },
}));

const mockGenerate = vi.fn();

vi.mock('@/services/recurringAccountService', () => ({
  ContaRecorrenteService: {
    generate: (...args: unknown[]) => mockGenerate(...args),
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
  mockGenerate.mockResolvedValue({ generated: 0 });
});

describe('OverviewDashboard - recurring bills of the month', () => {
  it('generates the month bills for admins before reading the totals', async () => {
    let finishGeneration: (value: unknown) => void = () => undefined;
    mockGenerate.mockReturnValue(new Promise((resolve) => { finishGeneration = resolve; }));
    renderWithQuery(<OverviewDashboard isAdmin />);

    await waitFor(() => expect(mockGenerate).toHaveBeenCalledTimes(1));
    const [from, to] = mockGenerate.mock.calls[0] as [Date, Date];
    const now = new Date();
    expect(from.getDate()).toBe(1);
    expect(from.getMonth()).toBe(now.getMonth());
    expect(to.getMonth()).toBe(now.getMonth());
    expect(to.getDate()).toBe(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
    expect(mockGetOverview).not.toHaveBeenCalled();

    finishGeneration({ generated: 3 });
    await waitFor(() => expect(mockGetOverview).toHaveBeenCalledTimes(1));
  });

  it('does not generate bills for regular users (recurring bills are admin only)', async () => {
    renderWithQuery(<OverviewDashboard />);

    await waitFor(() => expect(mockGetOverview).toHaveBeenCalledTimes(1));
    expect(mockGenerate).not.toHaveBeenCalled();
  });
});

describe('OverviewDashboard - valid HTML', () => {
  it('never renders a block badge inside a paragraph (category and ending-soon badges)', async () => {
    mockGetOverview.mockResolvedValue({
      ...baseOverview,
      recurring_accounts: baseOverview.recurring_accounts.map((r) => ({ ...r, is_ending_soon: true })),
    });
    const { container } = renderWithQuery(<OverviewDashboard isAdmin />);

    await waitFor(() => expect(screen.getByText('Acabando')).toBeTruthy());
    expect(container.querySelectorAll('p div')).toHaveLength(0);
  });
});

describe('OverviewDashboard', () => {
  it('renderiza indicadores principais, progresso do mês e cartão', async () => {
    renderWithQuery(<OverviewDashboard />);

    await waitFor(() => {
      expect(screen.getByText("Entradas")).toBeTruthy();
    });
    expect(screen.getByText(/R\$\s3\.200,00/)).toBeTruthy();
    expect(screen.getByText(/R\$\s1\.800,00/)).toBeTruthy();
    expect(screen.getAllByText('30%').length).toBeGreaterThan(0);
  });

  it('destaca categorias com limite estourado ou para estourar', async () => {
    renderWithQuery(<OverviewDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Compras')).toBeTruthy();
    });
    expect(screen.getByText('Estourado')).toBeTruthy();
    expect(screen.getByText('Para estourar')).toBeTruthy();
  });

  it('lista parcelas do mês e contas recorrentes a pagar', async () => {
    renderWithQuery(<OverviewDashboard />);

    await waitFor(() => {
      expect(screen.getByText(/Notebook - parcela 1\/10/)).toBeTruthy();
    });
    expect(screen.getByText(/Assinatura Netflix/)).toBeTruthy();
    expect(screen.getByText(/9\/12/)).toBeTruthy();
  });

  it('mostra metas e compras quando admin', async () => {
    renderWithQuery(<OverviewDashboard isAdmin />);

    await waitFor(() => {
      expect(screen.getByText('Eurotrip')).toBeTruthy();
    });
    expect(screen.getByText('Notebook')).toBeTruthy();
  });

  it('esconde metas e compras quando não-admin', async () => {
    renderWithQuery(<OverviewDashboard isAdmin={false} />);

    await waitFor(() => {
      expect(screen.getByText("Entradas")).toBeTruthy();
    });
    expect(screen.queryByText('Eurotrip')).toBeNull();
    expect(screen.queryByText('Notebook')).toBeNull();
  });

  it('refaz o fetch ao trocar o entity_type', async () => {
    const { getByRole, findByRole } = renderWithQuery(<OverviewDashboard />);

    await waitFor(() => {
      expect(mockGetOverview.mock.calls.length).toBeGreaterThan(0);
    });
    const callsBefore = mockGetOverview.mock.calls.length;

    fireEvent.click(await findByRole('button', { name: 'PJ' }));

    await waitFor(() => {
      expect(mockGetOverview.mock.calls.length).toBeGreaterThan(callsBefore);
    });
  });

  it('mostra badge "Estourando" no cartão quando passa do limite', async () => {
    mockGetOverview.mockResolvedValue({
      ...baseOverview,
      credit_card: { limit: 10000, used: 11500, remaining: -1500, percent_used: 115 },
    });

    renderWithQuery(<OverviewDashboard />);

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

    renderWithQuery(<OverviewDashboard />);

    await waitFor(() => {
      expect(screen.getByText('85%')).toBeTruthy();
    });
    expect(screen.queryByText('Estourando')).toBeNull();
  });

  it('mostra o estado de erro quando a busca falha', async () => {
    mockGetOverview.mockRejectedValue(new Error('falhou'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    renderWithQuery(<OverviewDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Erro ao carregar o dashboard')).toBeTruthy();
    });
  });

  it('mostra o esqueleto enquanto carrega, sem texto de erro', () => {
    mockGetOverview.mockReturnValue(new Promise(() => {}));

    const { container } = renderWithQuery(<OverviewDashboard />);

    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
    expect(screen.queryByText('Erro ao carregar o dashboard')).toBeNull();
  });

  it('reaproveita o cache ao voltar para um filtro já carregado', async () => {
    const { getByRole, findByRole } = renderWithQuery(<OverviewDashboard />);
    await waitFor(() => expect(screen.getByText('Entradas')).toBeTruthy());

    fireEvent.click(await findByRole('button', { name: 'PJ' }));
    await waitFor(() => expect(mockGetOverview).toHaveBeenCalledTimes(2));
    fireEvent.click(getByRole('button', { name: 'Ambos' }));

    await waitFor(() => expect(screen.getByText('Entradas')).toBeTruthy());
    expect(mockGetOverview).toHaveBeenCalledTimes(2);
  });

  it('busca o mês anterior ao navegar', async () => {
    const { getByRole } = renderWithQuery(<OverviewDashboard />);
    await waitFor(() => expect(screen.getByText('Entradas')).toBeTruthy());
    const [firstYear, firstMonth] = mockGetOverview.mock.calls[0] as [number, number];

    fireEvent.click(getByRole('button', { name: 'Mês anterior' }));

    await waitFor(() => expect(mockGetOverview).toHaveBeenCalledTimes(2));
    const [year, month] = mockGetOverview.mock.calls[1] as [number, number];
    expect(year * 12 + month).toBe(firstYear * 12 + firstMonth - 1);
  });
});

describe('OverviewDashboard no celular', () => {
  const originalWidth = window.innerWidth;
  afterEach(() => {
    window.innerWidth = originalWidth;
  });

  it('usa o layout de cards: saldo do mês em destaque e sem os indicadores do desktop', async () => {
    window.innerWidth = 390;
    renderWithQuery(
      <MemoryRouter>
        <OverviewDashboard />
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByTestId('hero-balance')).toBeTruthy());
    expect(screen.queryByLabelText('Mês anterior')).toBeNull();
    expect(screen.getByRole('radio', { name: 'Ambos' })).toBeTruthy();
  });
});
