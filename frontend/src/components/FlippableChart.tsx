import { useMemo } from 'react';
import { D3BarChart } from './D3BarChart';
import { D3DailyChart } from './D3DailyChart';
import { YearlyData, DailyData, SelectedMonth } from '@/types/financial';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

interface FlippableChartProps {
  yearlyData: YearlyData[];
  dailyData: DailyData[];
  monthlyGoal: number;
  selectedMonth: SelectedMonth | null;
  onMonthClick: (month: string) => void;
  onBackClick: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

export function FlippableChart({
  yearlyData,
  dailyData,
  monthlyGoal,
  selectedMonth,
  onMonthClick,
  onBackClick,
}: FlippableChartProps) {
  const isFlipped = selectedMonth !== null;
  const monthLabel = selectedMonth
    ? `${selectedMonth.name} ${selectedMonth.year}`
    : '';

  // Compute annual totals for legend
  const annualTotals = useMemo(() => {
    const income = yearlyData.reduce((s, d) => s + d.income, 0);
    const expenses = yearlyData.reduce((s, d) => s + d.expenses, 0);
    const investment = yearlyData.reduce((s, d) => s + d.investment, 0);
    return { income, expenses, investment };
  }, [yearlyData]);

  // Compute daily totals for back legend
  const dailyTotals = useMemo(() => {
    const income = dailyData.reduce((s, d) => s + d.income, 0);
    const expenses = dailyData.reduce((s, d) => s + d.expenses, 0);
    const investment = dailyData.reduce((s, d) => s + d.investment, 0);
    return { income, expenses, investment };
  }, [dailyData]);

  return (
    <div
      className="flip-container"
      style={{ perspective: '1000px', width: '100%', height: '400px' }}
    >
      <div
        className="flip-inner"
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          transformStyle: 'preserve-3d',
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
        }}
      >
        {/* Front: Yearly Chart */}
        <div
          className="chart-front"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateX(0deg)',
            zIndex: isFlipped ? 1 : 2,
            opacity: isFlipped ? 0 : 1,
            pointerEvents: isFlipped ? ('none' as const) : ('auto' as const),
            transition: 'opacity 0.3s',
          }}
        >
          <div className="flex flex-col h-full">
            {/* Title */}
            <h3 className="text-lg font-semibold shrink-0 px-2 pt-1">
              Rendimento Anual
            </h3>
            {/* Legend */}
            <div className="shrink-0 flex flex-wrap gap-x-4 gap-y-1 px-2 py-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ background: 'hsl(var(--success))' }}
                />
                Entradas: {formatCurrency(annualTotals.income)}
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ background: 'hsl(var(--destructive))' }}
                />
                Saidas: {formatCurrency(annualTotals.expenses)}
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ background: 'hsl(var(--warning))' }}
                />
                Investimento: {formatCurrency(annualTotals.investment)}
              </span>
            </div>
            {/* Chart fills remaining */}
            <div className="flex-1 min-h-0">
              <D3BarChart
                data={yearlyData}
                width={900}
                height={320}
                monthlyGoal={monthlyGoal}
                onBarClick={onMonthClick}
              />
            </div>
          </div>
        </div>

        {/* Back: Daily Chart */}
        <div
          className="chart-back"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
            zIndex: isFlipped ? 2 : 1,
            opacity: isFlipped ? 1 : 0,
            pointerEvents: isFlipped ? ('auto' as const) : ('none' as const),
            transition: 'opacity 0.3s',
          }}
        >
          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between shrink-0 px-2 pt-1">
              <span className="text-sm font-semibold text-foreground">
                {monthLabel} - Dia a Dia
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={onBackClick}
                className="gap-1 text-xs h-7"
              >
                <ArrowLeft className="h-3 w-3" />
                Voltar
              </Button>
            </div>
            {/* Legend */}
            <div className="shrink-0 flex flex-wrap gap-x-4 gap-y-1 px-2 py-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ background: 'hsl(var(--success))' }}
                />
                Entradas: {formatCurrency(dailyTotals.income)}
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ background: 'hsl(var(--destructive))' }}
                />
                Saidas: {formatCurrency(dailyTotals.expenses)}
              </span>
              <span className="flex items-center gap-1">
                <span
                  className="w-2.5 h-2.5 rounded-sm inline-block"
                  style={{ background: 'hsl(var(--warning))' }}
                />
                Investimento: {formatCurrency(dailyTotals.investment)}
              </span>
            </div>
            {/* Chart fills remaining */}
            <div className="flex-1 min-h-0">
              <D3DailyChart
                data={dailyData}
                width={900}
                height={290}
                selectedMonth={monthLabel}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
