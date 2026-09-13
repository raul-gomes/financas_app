import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FinancialDashboard } from './FinancialDashboard';

vi.mock('@/services/settingsService', () => ({
  SettingsService: { listBanks: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/components/charts/FlippableChart', () => ({
  FlippableChart: () => <div>flippable-chart</div>,
}));

vi.mock('@/components/charts/IncomeChart', () => ({
  IncomeChart: () => <div>entradas-por-periodo</div>,
}));

const baseProps = {
  yearlyData: [],
  totalInvested: 0,
  monthlyGoal: 0,
  currentMonthExpenses: 0,
  dateRange: { from: new Date('2026-09-01'), to: new Date('2026-09-30') },
  transactions: [],
  selectedMonth: null,
  incomeBreakdown: null,
  categoryBreakdown: null,
  onBackClick: vi.fn(),
};

describe('FinancialDashboard - rolagem dos boxes', () => {
  it('os boxes "Entradas por Período" e "Gastos por Categoria" rolam individualmente', () => {
    render(<FinancialDashboard {...baseProps} />);

    expect(screen.getByTestId('income-box').className).toContain('lg:overflow-y-auto');
    expect(screen.getByTestId('category-box').className).toContain('lg:overflow-y-auto');
  });

  it('o dashboard como um todo não acumula rolagem no desktop', () => {
    const { container } = render(<FinancialDashboard {...baseProps} />);
    const root = container.firstChild as HTMLElement;

    expect(root.className).toContain('lg:overflow-hidden');
    expect(root.className).not.toContain('lg:overflow-y-auto');
  });

  it('a linha de categorias ocupa o espaço restante e pode encolher', () => {
    render(<FinancialDashboard {...baseProps} />);

    const row = document.getElementById('dashboard-ancora-categorias');
    expect(row).not.toBeNull();
    expect(row!.className).toContain('lg:flex-1');
    expect(row!.className).toContain('lg:min-h-0');
  });
});
