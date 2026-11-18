import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MonthlyBarsChart } from './MonthlyBarsChart';
import type { RecentMonth } from '@/lib/recentMonths';

const MONTHS: RecentMonth[] = [
  { year: 2026, month: 6, label: 'jun', income: 1000, outflows: 500 },
  { year: 2026, month: 7, label: 'jul', income: 2000, outflows: 1000 },
  { year: 2026, month: 8, label: 'ago', income: 0, outflows: 0 },
  { year: 2026, month: 9, label: 'set', income: 500, outflows: 250 },
  { year: 2026, month: 10, label: 'out', income: 800, outflows: 400 },
  { year: 2026, month: 11, label: 'nov', income: 1200, outflows: 600 },
];

describe('MonthlyBarsChart', () => {
  it('draws one tappable group per month with the axis label', () => {
    render(<MonthlyBarsChart months={MONTHS} />);
    const group = screen.getByRole('group', { name: /Entradas e saídas por mês/ });
    expect(within(group).getAllByRole('button')).toHaveLength(6);
    expect(screen.getByText('jun')).toBeTruthy();
    expect(screen.getAllByText('nov').length).toBeGreaterThan(0);
  });

  it('scales bars to the largest value of the window', () => {
    render(<MonthlyBarsChart months={MONTHS} />);
    const julIncome = screen.getByTestId('bar-income-2026-7') as HTMLElement;
    const junIncome = screen.getByTestId('bar-income-2026-6') as HTMLElement;
    expect(julIncome.style.height).toBe('100%');
    expect(junIncome.style.height).toBe('50%');
    expect((screen.getByTestId('bar-income-2026-8') as HTMLElement).style.height).toBe('0%');
  });

  it('reads the last month first and the tapped month afterwards', () => {
    render(<MonthlyBarsChart months={MONTHS} />);
    const readout = screen.getByRole('status');
    expect(readout.textContent).toContain('nov 2026');
    expect(readout.textContent).toMatch(/R\$\s1\.200,00/);

    fireEvent.click(screen.getByRole('button', { name: /jul/ }));
    expect(readout.textContent).toContain('jul 2026');
    expect(readout.textContent).toMatch(/Entradas.*R\$\s2\.000,00/);
    expect(readout.textContent).toMatch(/Saídas.*R\$\s1\.000,00/);
  });

  it('puts the legend below the chart', () => {
    const { container } = render(<MonthlyBarsChart months={MONTHS} />);
    const chart = screen.getByRole('group', { name: /Entradas e saídas por mês/ });
    const legend = screen.getByTestId('chart-legend');
    expect(chart.compareDocumentPosition(legend) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(container.textContent).toContain('Toque numa barra para ver o valor');
  });
});
