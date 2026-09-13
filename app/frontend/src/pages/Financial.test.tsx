import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Financial from './Financial';

vi.mock('@/contexts/RoleContext', () => ({
  useRole: () => ({ isAdmin: false }),
}));

vi.mock('@/contexts/SidebarContext', () => ({
  useSidebar: () => ({ open: false, toggle: vi.fn(), setOpen: vi.fn() }),
}));

vi.mock('@/services/financialService', () => ({
  FinancialService: {
    getFinancialSummary: vi.fn().mockResolvedValue({
      transactions: [],
      total_income: 0,
      total_expenses: 0,
      monthly_goal: 0,
      credit_card_limit: 0,
      fixed_expenses: 0,
      variable_expenses: 0,
    }),
    getYearlyPerformance: vi.fn().mockResolvedValue({ months: {} }),
    getCategoryBreakdown: vi.fn().mockResolvedValue(null),
    getCategoryIncome: vi.fn().mockResolvedValue(null),
    getYearTransactions: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/services/recurringAccountService', () => ({
  ContaRecorrenteService: {
    generate: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/components/TransactionList', () => ({
  TransactionList: () => <div>Extrato Financeiro</div>,
}));

vi.mock('@/components/dashboards/FinancialDashboard', () => ({
  FinancialDashboard: () => <div>financial-dashboard</div>,
}));

vi.mock('@/components/dashboards/ChartAnchors', () => ({
  ChartAnchors: () => <div>chart-anchors</div>,
}));

vi.mock('@/components/layout/SidebarPanel', () => ({
  SidebarPanel: () => <div>sidebar-panel</div>,
}));

describe('Financial page - tela travada', () => {
  it('trava a área do dashboard em ~150vh no desktop', () => {
    render(<Financial />);

    const grid = screen.getByTestId('financial-dashboard-grid');
    expect(grid.className).toContain('lg:h-[calc(150vh-200px)]');
  });
});
