import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { FlippableChart } from '@/components/charts/FlippableChart';
import { IncomeChart } from '@/components/charts/IncomeChart';
import { CategoryBreakdownSection } from '@/components/CategoryBreakdownSection';
import { PaymentKpiCards } from '@/components/dashboards/PaymentKpiCards';
import { FixedVariableCard } from '@/components/dashboards/FixedVariableCard';
import { buildDailyData, EMPTY_STATEMENT_AGGREGATES } from '@/lib/statementAggregates';
import {
  YearlyData,
  DailyData,
  SelectedMonth,
  StatementAggregates,
  CategoryBreakdown,
  IncomeBySubcategoria,
} from '@/types/financial';

interface FinancialDashboardProps {
  yearlyData: YearlyData[];
  totalInvested: number;
  monthlyGoal: number;
  currentMonthExpenses: number;
  dateRange: { from: Date; to: Date };
  /** Server-side aggregates of the period (null while the statement loads). */
  statement: StatementAggregates | null;
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
  statement,
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

  const aggregates = statement ?? EMPTY_STATEMENT_AGGREGATES;

  // Daily chart of the selected month, from the server's daily totals
  const dailyData: DailyData[] = useMemo(
    () => (selectedMonth ? buildDailyData(aggregates.daily_totals, selectedMonth) : []),
    [aggregates.daily_totals, selectedMonth],
  );

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto lg:overflow-hidden">
      {/* Métricas principais: carrossel no mobile, 4 colunas no desktop */}
      <PaymentKpiCards
        expensesByPaymentMethod={aggregates.expenses_by_payment_method}
        expensesByBank={aggregates.expenses_by_bank}
        installmentsDue={aggregates.installments_due}
        creditCardLimit={creditCardLimit}
      />

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
