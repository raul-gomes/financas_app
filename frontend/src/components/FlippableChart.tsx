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

  return (
    <div className="flip-container" style={{ perspective: '1000px', width: '100%', height: '350px' }}>
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
          }}
        >
          <D3BarChart
            data={yearlyData}
            width={900}
            height={350}
            monthlyGoal={monthlyGoal}
            onBarClick={onMonthClick}
          />
        </div>

        {/* Back: Daily Chart */}
        <div
          className="chart-back"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)',
          }}
        >
          <div className="flex items-center justify-between px-2 mb-1">
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
          <D3DailyChart
            data={dailyData}
            width={900}
            height={310}
            selectedMonth={monthLabel}
          />
        </div>
      </div>
    </div>
  );
}
