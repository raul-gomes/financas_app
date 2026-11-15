import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { FlippableChart } from '@/components/charts/FlippableChart';
import { IncomeChart } from '@/components/charts/IncomeChart';
import { CategoryBreakdownSection } from '@/components/CategoryBreakdownSection';
import { PaymentKpiCards } from '@/components/dashboards/PaymentKpiCards';
import { FixedVariableCard } from '@/components/dashboards/FixedVariableCard';
import {
  YearlyData,
  DailyData,
  SelectedMonth,
  Transaction,
  CategoryBreakdown,
  IncomeBySubcategoria,
} from '@/types/financial';

interface FinancialDashboardProps {
  yearlyData: YearlyData[];
  totalInvested: number;
  monthlyGoal: number;
  currentMonthExpenses: number;
  dateRange: { from: Date; to: Date };
  transactions: Transaction[];
  selectedMonth: SelectedMonth | null;
  highlightedMonth?: SelectedMonth | null;
  incomeBreakdown: IncomeBySubcategoria | null;
  categoryBreakdown: CategoryBreakdown | null;
  onMonthSelect?: (monthIndex: number, year: number) => void;
  onBackClick: () => void;
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  creditCardLimit?: number;
  fixedExpenses?: number;
  variableExpenses?: number;
}

export function FinancialDashboard({
  yearlyData,
  totalInvested,
  monthlyGoal,
  currentMonthExpenses,
  dateRange,
  transactions,
  selectedMonth,
  highlightedMonth,
  incomeBreakdown,
  categoryBreakdown,
  onMonthSelect,
  onBackClick,
  onPrevMonth,
  onNextMonth,
  creditCardLimit = 0,
  fixedExpenses = 0,
  variableExpenses = 0,
}: FinancialDashboardProps) {
  const handleBarClick = (month: string, year?: number) => {
    const monthIndexMap: Record<string, number> = {
      'Jan': 0, 'Fev': 1, 'Mar': 2, 'Abr': 3, 'Mai': 4, 'Jun': 5,
      'Jul': 6, 'Ago': 7, 'Set': 8, 'Out': 9, 'Nov': 10, 'Dez': 11,
    };
    const monthIndex = monthIndexMap[month];
    if (monthIndex !== undefined && onMonthSelect) {
      onMonthSelect(monthIndex, year ?? new Date().getFullYear());
    }
  };

  // Compute daily data from transactions for the selected month
  const dailyData: DailyData[] = useMemo(() => {
    if (!selectedMonth) return [];
    const daysInMonth = new Date(selectedMonth.year, selectedMonth.index + 1, 0).getDate();
    const days: DailyData[] = Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      income: 0,
      expenses: 0,
      investment: 0,
    }));

    transactions.forEach((t) => {
      const date = new Date(t.transaction_date);
      if (date.getMonth() === selectedMonth.index && date.getFullYear() === selectedMonth.year) {
        const dayIdx = date.getDate() - 1;
        if (t.type === 'income') days[dayIdx].income += t.amount;
        else if (t.type === 'expense') days[dayIdx].expenses += t.amount;
        else if (t.type === 'investment') days[dayIdx].investment += t.amount;
      }
    });

    return days;
  }, [transactions, selectedMonth]);

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto lg:overflow-hidden">
      {/* Métricas principais: carrossel no mobile, 4 colunas no desktop */}
      <PaymentKpiCards transactions={transactions} creditCardLimit={creditCardLimit} />

      {/* Grafico de Barras - Rendimento Anual / Diario */}
      <div id="dashboard-ancora-rendimento" className="animate-slide-up shadow-card border-none rounded-lg bg-card flex-shrink-0" style={{ animationDelay: '400ms' }}>
        <div className="px-4 py-2 h-[400px] w-full">
          <FlippableChart
            yearlyData={yearlyData}
            dailyData={dailyData}
            monthlyGoal={monthlyGoal}
            selectedMonth={selectedMonth}
            highlightedMonth={highlightedMonth}
            onMonthClick={handleBarClick}
            onBackClick={onBackClick}
            onPrevMonth={onPrevMonth}
            onNextMonth={onNextMonth}
          />
        </div>
      </div>

      {/* Gastos Fixos vs Variáveis — logo abaixo do gráfico */}
      <div id="dashboard-ancora-fixos-variaveis" className="animate-slide-up" style={{ animationDelay: '600ms' }}>
        <FixedVariableCard fixedExpenses={fixedExpenses} variableExpenses={variableExpenses} />
      </div>

      {/* Income + Category charts in a 2-column grid */}
      <div id="dashboard-ancora-categorias" className="animate-slide-up grid grid-cols-1 lg:grid-cols-2 gap-4 flex-shrink-0 lg:flex-1 lg:min-h-0 lg:grid-rows-1" style={{ animationDelay: '800ms' }}>
        <Card data-testid="income-box" className="shadow-card border-none lg:min-h-0 lg:overflow-y-auto">
          <IncomeChart
            breakdown={incomeBreakdown}
            dateRange={dateRange}
          />
        </Card>
        <CategoryBreakdownSection
          categoryBreakdown={categoryBreakdown}
        />
      </div>
    </div>
  );
}
