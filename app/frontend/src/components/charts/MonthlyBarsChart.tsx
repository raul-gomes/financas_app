import { useState } from 'react';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { RecentMonth } from '@/lib/recentMonths';

/** Height of the bars area, in pixels. */
const CHART_HEIGHT_PX = 120;

interface MonthlyBarsChartProps {
  /** Months to draw, oldest first (the mobile chart shows 6). */
  months: readonly RecentMonth[];
}

/** Bar height as a percentage of the largest value in the window. */
function percentOf(value: number, max: number): number {
  return max > 0 ? Math.round((value / max) * 100) : 0;
}

/**
 * Grouped bar chart (income x outflows) for the mobile financial page: plain
 * HTML bars, one tappable group per month. The legend sits below the chart and
 * tapping a group reads its values (the selected month defaults to the last one).
 */
export function MonthlyBarsChart({ months }: MonthlyBarsChartProps) {
  const [selected, setSelected] = useState(months.length - 1);
  const current = months[Math.min(selected, months.length - 1)];
  const max = Math.max(0, ...months.flatMap((m) => [m.income, m.outflows]));

  return (
    <div>
      <div
        role="group"
        aria-label="Entradas e saídas por mês"
        className="flex items-stretch gap-1 border-b border-border"
        style={{ height: CHART_HEIGHT_PX }}
      >
        {months.map((m, index) => (
          <button
            key={`${m.year}-${m.month}`}
            type="button"
            aria-label={`${m.label}: entradas ${formatCurrency(m.income)}, saídas ${formatCurrency(m.outflows)}`}
            aria-pressed={index === selected}
            onClick={() => setSelected(index)}
            className={cn(
              'flex min-w-[44px] flex-1 items-end justify-center gap-[3px] rounded-t-md px-1 pt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              index === selected && 'bg-muted/60',
            )}
          >
            <span
              data-testid={`bar-income-${m.year}-${m.month}`}
              className="w-full max-w-[18px] rounded-t bg-success"
              style={{ height: `${percentOf(m.income, max)}%` }}
            />
            <span
              data-testid={`bar-outflows-${m.year}-${m.month}`}
              className="w-full max-w-[18px] rounded-t bg-destructive"
              style={{ height: `${percentOf(m.outflows, max)}%` }}
            />
          </button>
        ))}
      </div>
      <div aria-hidden="true" className="mt-1 flex gap-1 text-xs text-muted-foreground">
        {months.map((m) => (
          <span key={`${m.year}-${m.month}`} className="min-w-[44px] flex-1 text-center">
            {m.label}
          </span>
        ))}
      </div>
      <div data-testid="chart-legend" className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-success" />
          Entradas
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          Saídas
        </span>
        <span>Toque numa barra para ver o valor</span>
      </div>
      <p role="status" className="mt-2 text-sm text-foreground">
        <span className="font-semibold">
          {current.label} {current.year}
        </span>
        {' · '}
        <span className="text-success">Entradas {formatCurrency(current.income)}</span>
        {' · '}
        <span className="text-destructive">Saídas {formatCurrency(current.outflows)}</span>
      </p>
    </div>
  );
}
