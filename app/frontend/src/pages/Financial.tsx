import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { TransactionList } from '@/components/TransactionList';
import { FinancialDashboard } from '@/components/dashboards/FinancialDashboard';
import { ChartAnchors } from '@/components/dashboards/ChartAnchors';
import { SidebarPanel } from '@/components/layout/SidebarPanel';
import { FinancialMobile } from '@/components/dashboards/FinancialMobile';
import { toYearMonth, type YearMonth } from '@/lib/months';
import { Transaction, MonthlyBalance, YearlyData, SelectedMonth } from '@/types/financial';
import {
  useCategoryBreakdown,
  useCategoryIncome,
  useFinancialSummary,
  useRecurringGeneration,
  useYearlyPerformance,
} from '@/hooks/queries/useFinancialQueries';
import { useTransactionMutations, useYearInvestments } from '@/hooks/queries/useTransactionQueries';
import { BarChart3, ChevronDown, Calendar as CalendarIcon, Settings, TrendingUp, DollarSign, PanelRightOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSidebar } from '@/contexts/SidebarContext';
import { useRole } from '@/contexts/RoleContext';

const Financial = () => {
  const isMobile = useIsMobile();
  const { isAdmin } = useRole();
  const [selectedDateRange, setSelectedDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [selectedEntityType, setSelectedEntityType] = useState<'all' | 'pf' | 'pj'>('pf');
  const [selectedMonth, setSelectedMonth] = useState<SelectedMonth | null>(null);
  const getCurrentMonth = (): SelectedMonth => {
    const now = new Date();
    const shortNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return {
      name: shortNames[now.getMonth()],
      index: now.getMonth(),
      year: now.getFullYear(),
    };
  };
  // Persists the last clicked month so the annual chart stays highlighted
  const [highlightedMonth, setHighlightedMonth] = useState<SelectedMonth | null>(getCurrentMonth());
  const requestedMonthRef = useRef<SelectedMonth | null>(null);
  const currentYear = new Date().getFullYear();


  // Server data: one cached query per block. Admins first generate the period's recurring
  // bills, then the dashboards load (the transactions list pages itself in TransactionList).
  const { isSettled: recurringReady } = useRecurringGeneration(selectedDateRange, isAdmin);
  const summaryQuery = useFinancialSummary(selectedDateRange, selectedEntityType, recurringReady);
  // The 12-month chart and its investment bars are desktop only (mobile shows 6 months)
  const yearlyQuery = useYearlyPerformance(currentYear, selectedEntityType, recurringReady && !isMobile);
  const categoriesQuery = useCategoryBreakdown(
    selectedDateRange,
    selectedEntityType,
    'expense',
    recurringReady,
  );
  const incomesQuery = useCategoryIncome(selectedDateRange, selectedEntityType, recurringReady);
  // Always fetch full-year investments for the yearly chart
  const yearInvestmentsQuery = useYearInvestments(currentYear, selectedEntityType, recurringReady && !isMobile);
  const { updateTransaction, deleteTransaction, onTransactionCreated } = useTransactionMutations();

  const financialSummary = summaryQuery.data ?? null;
  const yearlyPerformance = yearlyQuery.data ?? null;
  const categoryBreakdown = categoriesQuery.data ?? null;
  const incomeBreakdown = incomesQuery.data ?? null;
  const yearTransactions = useMemo(() => yearInvestmentsQuery.data ?? [], [yearInvestmentsQuery.data]);

  // If a month was requested, activate the flip once that month's data (not the previous
  // period's placeholder) has loaded
  useEffect(() => {
    if (summaryQuery.isSuccess && !summaryQuery.isPlaceholderData && requestedMonthRef.current) {
      setSelectedMonth(requestedMonthRef.current);
      requestedMonthRef.current = null;
    }
  }, [summaryQuery.isSuccess, summaryQuery.isPlaceholderData, summaryQuery.data]);

  // Reset highlighted month when entity type changes
  useEffect(() => {
    setHighlightedMonth(getCurrentMonth());
  }, [selectedEntityType]);


  // Handle both old (pf/pj) and new (individual/business) entity_type values
  const normalizeEntityType = (val: string): string =>
    val === 'pf' ? 'individual' : val === 'pj' ? 'business' : val;

  // Monthly balance (investimentos contam como saída)
  const monthlyBalance: MonthlyBalance = useMemo(() => {
    if (!financialSummary) return { income: 0, expenses: 0, balance: 0 };
    const totalExpenses = financialSummary.total_expenses + financialSummary.total_invested;
    return {
      income: financialSummary.total_income,
      expenses: totalExpenses,
      balance: financialSummary.total_income - totalExpenses
    };
  }, [financialSummary]);

   // Yearly data
   const yearlyData: YearlyData[] = useMemo(() => {
    if (!yearlyPerformance?.months) return [];
      const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      // Filter year transactions by selected entity type for investment calculation
      const filteredYearTx = selectedEntityType === 'all'
        ? yearTransactions
        : yearTransactions.filter(t =>
            normalizeEntityType(t.entity_type) === normalizeEntityType(selectedEntityType)
          );
      const investmentSums: Record<number, number> = {};
      filteredYearTx.forEach(t => {
        if (t.type === 'investment') {
          const date = new Date(t.transaction_date);
          const monthIdx = date.getMonth();
          investmentSums[monthIdx] = (investmentSums[monthIdx] || 0) + t.amount;
        }
      });
       // Object.entries preserves order defined by backend (janeiro, fevereiro…)
       return Object.entries(yearlyPerformance.months).map(
         ([monthKey, vals], idx) => ({
           month: names[idx],
           income: vals.income,
           expenses: vals.expense,
           profit: vals.income - vals.expense,
          investment: investmentSums[idx] || 0
        })
      );
    }, [yearlyPerformance, yearTransactions, selectedEntityType]);

  // Mutations refresh every derived query (list, dashboards, overview, limits, goals)
  const handleAddTransaction = async (_newTransaction: Transaction) => {
    // The dialog already called the add API: just refresh the data
    await onTransactionCreated();
  };
  const handleEditTransaction = async (id: number, updated: Partial<Transaction>) => {
    await updateTransaction(id, updated);
  };
  const handleDeleteTransaction = async (id: number) => {
    await deleteTransaction(id);
  };

  const handleMonthSelect = useCallback((monthIndex: number, year: number) => {
    const from = new Date(year, monthIndex, 1);
    const to = endOfMonth(from);
    setSelectedDateRange({ from, to });
    // Short names must match the bar chart labels (names array in yearlyData useMemo)
    const shortNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const sel: SelectedMonth = {
      name: shortNames[monthIndex],
      index: monthIndex,
      year,
    };
    setHighlightedMonth(sel);
    // Reset current flip and store the month in a ref
    // The flip will be activated by the effect above when fresh data arrives
    setSelectedMonth(null);
    requestedMonthRef.current = sel;
  }, []);

  const handleBackClick = useCallback(() => {
    const now = new Date();
    setSelectedMonth(null);
    setHighlightedMonth(getCurrentMonth());
    setSelectedDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
    requestedMonthRef.current = null;
  }, []);

  const handlePrevMonth = useCallback(() => {
    if (!selectedMonth) return;
    const newDate = new Date(selectedMonth.year, selectedMonth.index - 1, 1);
    const prevIdx = newDate.getMonth();
    const prevYear = newDate.getFullYear();
    const from = new Date(prevYear, prevIdx, 1);
    const to = endOfMonth(from);
    setSelectedDateRange({ from, to });
    const shortNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const sel: SelectedMonth = { name: shortNames[prevIdx], index: prevIdx, year: prevYear };
    setHighlightedMonth(sel);
    setSelectedMonth(sel);
    requestedMonthRef.current = null;
  }, [selectedMonth]);

  const handleNextMonth = useCallback(() => {
    if (!selectedMonth) return;
    const newDate = new Date(selectedMonth.year, selectedMonth.index + 1, 1);
    const nextIdx = newDate.getMonth();
    const nextYear = newDate.getFullYear();
    const from = new Date(nextYear, nextIdx, 1);
    const to = endOfMonth(from);
    setSelectedDateRange({ from, to });
    const shortNames = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const sel: SelectedMonth = { name: shortNames[nextIdx], index: nextIdx, year: nextYear };
    setHighlightedMonth(sel);
    setSelectedMonth(sel);
    requestedMonthRef.current = null;
  }, [selectedMonth]);

  const currentPeriodExpenses = monthlyBalance.expenses;
  const sidebar = useSidebar();

  // Mobile: the month stepper in the top bar replaces the range picker
  const fromTime = selectedDateRange.from.getTime();
  const mobileMonth = useMemo(() => toYearMonth(new Date(fromTime)), [fromTime]);
  const handleMobileMonthChange = useCallback((ym: YearMonth) => {
    const from = new Date(ym.year, ym.month - 1, 1);
    setSelectedDateRange({ from, to: endOfMonth(from) });
  }, []);

  if (isMobile) {
    return (
      <div className="min-h-screen bg-gradient-subtle">
        <FinancialMobile
          month={mobileMonth}
          onMonthChange={handleMobileMonthChange}
          entityType={selectedEntityType}
          onEntityTypeChange={setSelectedEntityType}
          dateRange={selectedDateRange}
          statement={financialSummary}
          creditCardLimit={financialSummary?.credit_card_limit || 0}
          fixedExpenses={financialSummary?.fixed_expenses || 0}
          variableExpenses={financialSummary?.variable_expenses || 0}
          incomeBreakdown={incomeBreakdown}
          categoryBreakdown={categoryBreakdown}
          onEditTransaction={handleEditTransaction}
          onDeleteTransaction={handleDeleteTransaction}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="flex">
        {isAdmin && (
          <SidebarPanel open={sidebar.open} onClose={() => sidebar.toggle()} entityType={selectedEntityType} />
        )}
        <div className="flex-1 min-w-0">
          <main className="w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {/* Date Range Picker + Sidebar Toggle */}
            <div className="w-full flex justify-between items-center gap-2 mb-4">
              {isAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => sidebar.toggle()}
                  className="flex items-center gap-1.5"
                  title="Metas e Compras"
                >
                  <PanelRightOpen className={`h-4 w-4 transition-transform ${sidebar.open ? 'rotate-180' : ''}`} />
                  <span className="hidden sm:inline text-xs">Metas/Objetivos</span>
                </Button>
              )}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full max-w-[260px] justify-start text-left font-normal",
                      "flex items-center gap-2"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4" />
                    {selectedDateRange.from
                      ? selectedDateRange.to
                        ? `${format(selectedDateRange.from, "dd/MM/yyyy")} - ${format(selectedDateRange.to, "dd/MM/yyyy")}`
                        : format(selectedDateRange.from, "dd/MM/yyyy")
                      : "Selecionar período"}
                    <ChevronDown className="h-4 w-4 ml-auto" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    initialFocus
                    mode="range"
                    defaultMonth={selectedDateRange.from}
                    selected={{
                      from: selectedDateRange.from,
                      to: selectedDateRange.to
                    }}
                    onSelect={(range) => {
                      if (range?.from) {
                        setSelectedDateRange({
                          from: range.from,
                          to: range.to || range.from
                        });
                      }
                    }}
                    numberOfMonths={isMobile ? 1 : 2}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Âncoras de navegação para cada gráfico do dashboard */}
            <ChartAnchors
              items={[
                { id: 'dashboard-ancora-metricas', label: 'Métricas' },
                { id: 'dashboard-ancora-rendimento', label: 'Rendimento' },
                { id: 'dashboard-ancora-fixos-variaveis', label: 'Fixos vs Variáveis' },
                { id: 'dashboard-ancora-categorias', label: 'Categorias' },
              ]}
            />

            <div data-testid="financial-dashboard-grid" className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-8">
              {/* Dashboard */}
              <div data-testid="financial-dashboard-cell" className="lg:col-span-3 animate-fade-in flex flex-col lg:min-h-[calc(100vh-200px)] lg:max-h-[calc(130vh-200px)] lg:overflow-hidden">
                <FinancialDashboard
                  yearlyData={yearlyData}
                  totalInvested={monthlyBalance?.balance || 0}
                  monthlyGoal={financialSummary?.monthly_goal || 0}
                  currentMonthExpenses={currentPeriodExpenses}
                  dateRange={selectedDateRange}
                  statement={financialSummary}
                  selectedMonth={selectedMonth}
                  highlightedMonth={highlightedMonth}
                  incomeBreakdown={incomeBreakdown}
                  categoryBreakdown={categoryBreakdown}
                  onMonthSelect={handleMonthSelect}
                  onBackClick={handleBackClick}
                  onPrevMonth={handlePrevMonth}
                  onNextMonth={handleNextMonth}
                  creditCardLimit={financialSummary?.credit_card_limit || 0}
                  fixedExpenses={financialSummary?.fixed_expenses || 0}
                  variableExpenses={financialSummary?.variable_expenses || 0}
                />
              </div>
              {/* Transactions List */}
              <div className="lg:col-span-2 animate-slide-up flex flex-col lg:min-h-[calc(100vh-200px)] lg:max-h-[calc(130vh-200px)]">
                <div className="bg-card rounded-lg shadow-card border border-border h-full flex flex-col min-h-0">
                  <TransactionList
                    monthlyBalance={monthlyBalance}
                    onAddTransaction={handleAddTransaction}
                    onEditTransaction={handleEditTransaction}
                    onDeleteTransaction={handleDeleteTransaction}
                    dateRange={selectedDateRange}
                    selectedEntityType={selectedEntityType}
                    onEntityTypeChange={setSelectedEntityType}
                  />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
};

export default Financial;
