import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithQuery } from '@/test/queryWrapper';
import { FinancialDashboard } from './FinancialDashboard';
import { EMPTY_STATEMENT_AGGREGATES } from '@/lib/statementAggregates';
import type { DailyData } from '@/types/financial';

vi.mock('@/services/settingsService', () => ({
  SettingsService: { listBanks: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/components/charts/FlippableChart', () => ({
  FlippableChart: ({ dailyData }: { dailyData: DailyData[] }) => (
    <div data-testid="flippable-chart">{JSON.stringify(dailyData.filter((d) => d.expenses > 0))}</div>
  ),
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
  statement: null,
  selectedMonth: null,
  incomeBreakdown: null,
  categoryBreakdown: null,
  onBackClick: vi.fn(),
};

describe('FinancialDashboard - rolagem dos boxes', () => {
  it('os boxes "Entradas por Período" e "Gastos por Categoria" rolam individualmente', () => {
    renderWithQuery(<FinancialDashboard {...baseProps} />);

    expect(screen.getByTestId('income-box').className).toContain('lg:overflow-y-auto');
    expect(screen.getByTestId('category-box').className).toContain('lg:overflow-y-auto');
  });

  it('o dashboard como um todo não acumula rolagem no desktop', () => {
    const { container } = renderWithQuery(<FinancialDashboard {...baseProps} />);
    const root = container.firstChild as HTMLElement;

    expect(root.className).toContain('lg:overflow-hidden');
    expect(root.className).not.toContain('lg:overflow-y-auto');
  });

  it('a linha de categorias ocupa o espaço restante e pode encolher', () => {
    renderWithQuery(<FinancialDashboard {...baseProps} />);

    const row = document.getElementById('dashboard-ancora-categorias');
    expect(row).not.toBeNull();
    expect(row!.className).toContain('lg:flex-1');
    expect(row!.className).toContain('lg:min-h-0');
  });

  it('mostra badge "Estourando" no cartão ao passar do limite', async () => {
    const statement = {
      ...EMPTY_STATEMENT_AGGREGATES,
      expenses_by_payment_method: [{ payment_method: 'credit', total: 1200 }],
    };

    renderWithQuery(<FinancialDashboard {...baseProps} statement={statement} creditCardLimit={1000} />);

    expect((await screen.findByText('Estourando')).textContent).toContain('Estourando');
  });

  it('alimenta o gráfico diário do mês selecionado com os totais diários do servidor', () => {
    const statement = {
      ...EMPTY_STATEMENT_AGGREGATES,
      daily_totals: [{ date: '2026-09-10', income: 0, expenses: 40, investment: 0 }],
    };

    renderWithQuery(
      <FinancialDashboard
        {...baseProps}
        statement={statement}
        selectedMonth={{ name: 'Set', index: 8, year: 2026 }}
      />,
    );

    expect(JSON.parse(screen.getByTestId('flippable-chart').textContent ?? '[]')).toEqual([
      { day: 10, income: 0, expenses: 40, investment: 0 },
    ]);
  });
});
