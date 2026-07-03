import { useMemo } from 'react';
import { D3BarChart } from './D3BarChart';
import { D3DailyChart } from './D3DailyChart';
import { YearlyData, DailyData, SelectedMonth } from '@/types/financial';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

interface FlippableChartProps {
  yearlyData: YearlyData[];
  dailyData: DailyData[];
  monthlyGoal: number;
  selectedMonth: SelectedMonth | null;
  highlightedMonth?: SelectedMonth | null;
  onMonthClick: (month: string) => void;
  onBackClick: () => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

export function FlippableChart({
  yearlyData,
  dailyData,
  monthlyGoal,
  selectedMonth,
  highlightedMonth,
  onMonthClick,
  onBackClick,
  onPrevMonth,
  onNextMonth,
}: FlippableChartProps) {
  const isFlipped = selectedMonth !== null;
  const fullMonthNames = [
    'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];
  const monthLabel = selectedMonth
    ? `${fullMonthNames[selectedMonth.index]} ${selectedMonth.year}`
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
      style={{ perspective: '1000px', width: '100%', height: '100%' }}
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
            {/* Title + Legend combined in one row */}
            <div className="flex items-center shrink-0 px-2 pt-1">
              <h3 className="text-lg font-semibold shrink-0">
                Rendimento Anual
              </h3>
              <div className="flex items-center gap-4 text-xs text-muted-foreground ml-auto">
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ background: 'hsl(var(--success))' }}
                  />
                  {formatCurrency(annualTotals.income)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ background: 'hsl(var(--destructive))' }}
                  />
                  {formatCurrency(annualTotals.expenses)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ background: 'hsl(var(--warning))' }}
                  />
                  {formatCurrency(annualTotals.investment)}
                </span>
              </div>
            </div>
            {/* Chart fills remaining */}
            <div className="flex-1 min-h-0 relative">
              <D3BarChart
                data={yearlyData}
                width={900}
                height={320}
                monthlyGoal={monthlyGoal}
                selectedMonth={highlightedMonth?.name ?? null}
                onBarClick={onMonthClick}
              />
            </div>
          </div>
        </div>

        {/* Back: Daily Chart */}
          <div
            className="chart-back group"
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
            {/* Header + Legend combined in one row */}
            <div className="flex items-center justify-between shrink-0 px-2 pt-1">
              <span className="text-sm font-semibold text-foreground">
                {monthLabel}
              </span>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ background: 'hsl(var(--success))' }}
                  />
                  {formatCurrency(dailyTotals.income)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ background: 'hsl(var(--destructive))' }}
                  />
                  {formatCurrency(dailyTotals.expenses)}
                </span>
                <span className="flex items-center gap-1.5">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ background: 'hsl(var(--warning))' }}
                  />
                  {formatCurrency(dailyTotals.investment)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onBackClick}
                  className="gap-1 text-xs h-7 ml-2"
                >
                  <ArrowLeft className="h-3 w-3" />
                  Voltar
                </Button>
              </div>
            </div>
            {/* Chart fills remaining */}
            <div className="flex-1 min-h-0 relative">
              <D3DailyChart
                data={dailyData}
                width={900}
                height={320}
                selectedMonth={monthLabel}
                monthlyGoal={monthlyGoal}
              />
              {/* Prev month arrow */}
              <button
                onClick={onPrevMonth}
                disabled={!onPrevMonth}
                className="absolute left-0 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-background/70 hover:bg-background/90 text-muted-foreground hover:text-foreground shadow-sm transition-all opacity-0 group-hover:opacity-100 border border-border/50 disabled:opacity-0 disabled:cursor-default"
                title="Mês anterior"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {/* Next month arrow */}
              <button
                onClick={onNextMonth}
                disabled={!onNextMonth}
                className="absolute right-0 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full bg-background/70 hover:bg-background/90 text-muted-foreground hover:text-foreground shadow-sm transition-all opacity-0 group-hover:opacity-100 border border-border/50 disabled:opacity-0 disabled:cursor-default"
                title="Próximo mês"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
