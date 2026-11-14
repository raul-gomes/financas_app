import { Card } from '@/components/ui/card';
import { ChartAnchors } from '@/components/dashboards/ChartAnchors';
import { PaymentKpiCards } from '@/components/dashboards/PaymentKpiCards';
import { FixedVariableCard } from '@/components/dashboards/FixedVariableCard';
import { MonthlyBarsChart } from '@/components/charts/MonthlyBarsChart';
import { IncomeChart } from '@/components/charts/IncomeChart';
import { CategoryBreakdownSection } from '@/components/CategoryBreakdownSection';
import { TransactionListMobile } from '@/components/TransactionListMobile';
import { MobileTopBarSlot } from '@/components/layout/MobileTopBar';
import { MonthStepper } from '@/components/layout/MonthStepper';
import { useRecentMonths } from '@/hooks/queries/useFinancialQueries';
import type { YearMonth } from '@/lib/months';
import type { CategoryBreakdown, IncomeBySubcategoria, Transaction } from '@/types/financial';

type EntityScope = 'all' | 'pf' | 'pj';

/** Section chips (each scrolls to its section below). */
const SECTION_ANCHORS = [
  { id: 'dashboard-ancora-metricas', label: 'Resumo' },
  { id: 'dashboard-ancora-rendimento', label: 'Rendimento' },
  { id: 'dashboard-ancora-fixos-variaveis', label: 'Fixos × variáveis' },
  { id: 'dashboard-ancora-categorias', label: 'Categorias' },
] as const;

interface FinancialMobileProps {
  month: YearMonth;
  onMonthChange: (month: YearMonth) => void;
  entityType: EntityScope;
  onEntityTypeChange: (type: EntityScope) => void;
  dateRange: { from: Date; to: Date };
  /** Transactions of the period (feed the payment KPI cards). */
  transactions: Transaction[];
  creditCardLimit: number;
  fixedExpenses: number;
  variableExpenses: number;
  incomeBreakdown: IncomeBySubcategoria | null;
  categoryBreakdown: CategoryBreakdown | null;
  onEditTransaction: (id: number, changes: Partial<Transaction>) => Promise<void>;
  onDeleteTransaction: (id: number) => Promise<void>;
}

/**
 * The `/financial` page below `md`: month stepper in the top bar, section chips,
 * KPI carousel, 6-month bar chart, the day-grouped transactions list and the
 * remaining breakdown cards, in that order.
 */
export function FinancialMobile({
  month,
  onMonthChange,
  entityType,
  onEntityTypeChange,
  dateRange,
  transactions,
  creditCardLimit,
  fixedExpenses,
  variableExpenses,
  incomeBreakdown,
  categoryBreakdown,
  onEditTransaction,
  onDeleteTransaction,
}: FinancialMobileProps) {
  const recent = useRecentMonths(month, entityType, true);

  return (
    <div className="min-w-0 space-y-4 px-4 py-4">
      <MobileTopBarSlot>
        <MonthStepper year={month.year} month={month.month} onChange={onMonthChange} />
      </MobileTopBarSlot>

      <ChartAnchors items={[...SECTION_ANCHORS]} />

      <PaymentKpiCards transactions={transactions} creditCardLimit={creditCardLimit} />

      <Card id="dashboard-ancora-rendimento" className="scroll-mt-20 border-none p-4 shadow-card">
        <h2 className="mb-3 text-sm font-bold text-foreground">Últimos 6 meses</h2>
        {recent.isPending ? (
          <p role="status" className="py-10 text-center text-sm text-muted-foreground">
            Carregando gráfico...
          </p>
        ) : (
          <MonthlyBarsChart months={recent.months} />
        )}
      </Card>

      <TransactionListMobile
        onEditTransaction={onEditTransaction}
        onDeleteTransaction={onDeleteTransaction}
        dateRange={dateRange}
        selectedEntityType={entityType}
        onEntityTypeChange={onEntityTypeChange}
      />

      <div id="dashboard-ancora-fixos-variaveis" className="scroll-mt-20">
        <FixedVariableCard fixedExpenses={fixedExpenses} variableExpenses={variableExpenses} />
      </div>

      <div id="dashboard-ancora-categorias" className="scroll-mt-20 space-y-4">
        <Card data-testid="income-box" className="border-none shadow-card">
          <IncomeChart breakdown={incomeBreakdown} dateRange={dateRange} />
        </Card>
        <CategoryBreakdownSection categoryBreakdown={categoryBreakdown} />
      </div>
    </div>
  );
}
