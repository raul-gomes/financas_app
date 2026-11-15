import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithQuery } from '@/test/queryWrapper';
import Financial from './Financial';

const mockIsAdmin = vi.fn(() => false);
const mockIsMobile = vi.fn(() => false);

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => mockIsMobile(),
}));

vi.mock('@/components/TransactionListMobile', () => ({
  TransactionListMobile: () => <div data-testid="transaction-list-mobile" />,
}));

vi.mock('@/contexts/RoleContext', () => ({
  useRole: () => ({ isAdmin: mockIsAdmin() }),
}));

vi.mock('@/contexts/SidebarContext', () => ({
  useSidebar: () => ({ open: false, toggle: vi.fn(), setOpen: vi.fn() }),
}));

const mockSummary = vi.fn();
const mockYearly = vi.fn();
const mockBreakdown = vi.fn();
const mockIncome = vi.fn();
const mockYearInvestments = vi.fn();
const mockDelete = vi.fn();

vi.mock('@/services/financialService', () => ({
  TRANSACTIONS_PAGE_SIZE: 30,
  FinancialService: {
    getFinancialSummary: (...args: unknown[]) => mockSummary(...args),
    getYearlyPerformance: (...args: unknown[]) => mockYearly(...args),
    getCategoryBreakdown: (...args: unknown[]) => mockBreakdown(...args),
    getCategoryIncome: (...args: unknown[]) => mockIncome(...args),
    getYearInvestments: (...args: unknown[]) => mockYearInvestments(...args),
    updateTransaction: vi.fn(),
    deleteTransaction: (...args: unknown[]) => mockDelete(...args),
  },
}));

interface TransactionListProps {
  monthlyBalance: { income: number; expenses: number; balance: number };
  onDeleteTransaction: (id: number) => Promise<void>;
  selectedEntityType: string;
  onEntityTypeChange: (type: 'all' | 'pf' | 'pj') => void;
}

vi.mock('@/components/TransactionList', () => ({
  TransactionList: (props: TransactionListProps) => (
    <div>
      <span>Extrato Financeiro</span>
      <span data-testid="entity">{props.selectedEntityType}</span>
      <span data-testid="balance">{JSON.stringify(props.monthlyBalance)}</span>
      <button onClick={() => props.onEntityTypeChange('pj')}>pj</button>
      <button onClick={() => props.onDeleteTransaction(5)}>delete-5</button>
    </div>
  ),
}));

interface DashboardProps {
  monthlyGoal: number;
  yearlyData: { month: string; investment: number }[];
  selectedMonth: { index: number } | null;
  onMonthSelect: (monthIndex: number, year: number) => void;
}

vi.mock('@/components/dashboards/FinancialDashboard', () => ({
  FinancialDashboard: (props: DashboardProps) => (
    <div>
      <span data-testid="goal">{props.monthlyGoal}</span>
      <span data-testid="investment-jan">{props.yearlyData[0]?.investment ?? 'none'}</span>
      <span data-testid="selected-month">{props.selectedMonth ? props.selectedMonth.index : 'none'}</span>
      <button onClick={() => props.onMonthSelect(2, 2026)}>select-march</button>
    </div>
  ),
}));

vi.mock('@/components/dashboards/ChartAnchors', () => ({
  ChartAnchors: () => <div>chart-anchors</div>,
}));

vi.mock('@/components/layout/SidebarPanel', () => ({
  SidebarPanel: () => <div>sidebar-panel</div>,
}));

function summary(monthlyGoal = 1000) {
  return {
    total_income: 0,
    total_expenses: 0,
    total_invested: 0,
    daily_totals: [],
    expenses_by_payment_method: [],
    expenses_by_bank: [],
    installments_due: { remaining_amount: 0, remaining_installments: 0, transactions: 0, by_bank: [] },
    monthly_goal: monthlyGoal,
    credit_card_limit: 0,
    fixed_expenses: 0,
    variable_expenses: 0,
  };
}

const yearly = {
  months: { janeiro: { income: 10, expense: 5 } },
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsAdmin.mockReturnValue(false);
  mockIsMobile.mockReturnValue(false);
  mockSummary.mockResolvedValue(summary());
  mockYearly.mockResolvedValue(yearly);
  mockBreakdown.mockResolvedValue(null);
  mockIncome.mockResolvedValue(null);
  mockYearInvestments.mockResolvedValue([]);
  mockDelete.mockResolvedValue(undefined);
});

describe('Financial page - altura da tela', () => {
  it('inicia em ~100vh e limita o crescimento em ~130vh no desktop', () => {
    renderWithQuery(<Financial />);

    const cell = screen.getByTestId('financial-dashboard-cell');
    expect(cell.className).toContain('lg:min-h-[calc(100vh-200px)]');
    expect(cell.className).toContain('lg:max-h-[calc(130vh-200px)]');
  });
});

describe('Financial page - dados com react-query', () => {
  it('carrega cada bloco uma vez com o escopo PF e entrega a meta ao dashboard', async () => {
    mockSummary.mockResolvedValue(summary(2500));

    renderWithQuery(<Financial />);

    await waitFor(() => expect(screen.getByTestId('goal').textContent).toBe('2500'));
    expect(mockSummary).toHaveBeenCalledTimes(1);
    expect(mockSummary.mock.calls[0][1]).toBe('pf');
    expect(mockYearly).toHaveBeenCalledTimes(1);
    expect(mockBreakdown).toHaveBeenCalledTimes(1);
    expect(mockIncome).toHaveBeenCalledTimes(1);
    expect(mockYearInvestments).toHaveBeenCalledTimes(1);
  });

  it('conta os investimentos do período (total_invested) como saída no saldo', async () => {
    mockSummary.mockResolvedValue({ ...summary(), total_income: 1000, total_expenses: 300, total_invested: 200 });

    renderWithQuery(<Financial />);

    await waitFor(() =>
      expect(JSON.parse(screen.getByTestId('balance').textContent ?? '{}')).toEqual({
        income: 1000,
        expenses: 500,
        balance: 500,
      }),
    );
  });

  it('soma os investimentos do ano por mês nos dados anuais', async () => {
    mockYearInvestments.mockResolvedValue([
      { id: 1, type: 'investment', amount: 100, entity_type: 'individual', transaction_date: '2026-01-10T00:00:00' },
      { id: 2, type: 'investment', amount: 50, entity_type: 'individual', transaction_date: '2026-01-20T00:00:00' },
    ]);

    renderWithQuery(<Financial />);

    await waitFor(() => expect(screen.getByTestId('investment-jan').textContent).toBe('150'));
  });

  it('refaz as buscas com o novo escopo ao trocar PF/PJ', async () => {
    renderWithQuery(<Financial />);
    await waitFor(() => expect(mockSummary).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('pj'));

    await waitFor(() => expect(mockSummary).toHaveBeenCalledTimes(2));
    expect(mockSummary.mock.calls[1][1]).toBe('pj');
    expect(screen.getByTestId('entity').textContent).toBe('pj');
  });

  it.each([
    ['admin no desktop', true, false],
    ['admin no celular', true, true],
    ['usuário comum', false, false],
  ])('%s: busca os dashboards direto, sem disparar geração de recorrentes', async (_label, admin, mobile) => {
    mockIsAdmin.mockReturnValue(admin);
    mockIsMobile.mockReturnValue(mobile);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');

    renderWithQuery(<Financial />);

    await waitFor(() => expect(mockSummary).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(mockYearly).toHaveBeenCalled());
    const urls = fetchSpy.mock.calls.map(([input]) => String(input));
    expect(urls.some((url) => url.includes('/recurring-accounts/generate'))).toBe(false);
    fetchSpy.mockRestore();
  });

  it('só ativa a virada do mês depois que os dados do mês chegam', async () => {
    renderWithQuery(<Financial />);
    await waitFor(() => expect(mockSummary).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByTestId('goal').textContent).toBe('1000'));
    let finishMonth: (value: ReturnType<typeof summary>) => void = () => {};
    mockSummary.mockReturnValueOnce(new Promise((resolve) => { finishMonth = resolve; }));

    fireEvent.click(screen.getByText('select-march'));

    await waitFor(() => expect(mockSummary).toHaveBeenCalledTimes(2));
    expect(screen.getByTestId('selected-month').textContent).toBe('none');

    finishMonth(summary(1));

    await waitFor(() => expect(screen.getByTestId('selected-month').textContent).toBe('2'));
  });

  it('excluir uma transação chama a API e recarrega os dashboards', async () => {
    renderWithQuery(<Financial />);
    await waitFor(() => expect(mockSummary).toHaveBeenCalledTimes(1));

    fireEvent.click(screen.getByText('delete-5'));

    await waitFor(() => expect(mockDelete).toHaveBeenCalledWith(5));
    await waitFor(() => expect(mockSummary).toHaveBeenCalledTimes(2));
    expect(mockYearly).toHaveBeenCalledTimes(2);
  });
});
