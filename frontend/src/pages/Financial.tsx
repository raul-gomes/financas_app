import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { TransactionList } from '@/components/TransactionList';
import { FinancialDashboard } from '@/components/FinancialDashboard';
import {
  Transaction,
  MonthlyBalance,
  YearlyData,
  FinancialSummary,
  YearlyPerformance,
  CategoryBreakdown,
  SelectedMonth,
} from '@/types/financial';
import { FinancialService } from '@/services/financialService';
import { ContaRecorrenteService } from '@/services/contaRecorrenteService';
import { BarChart3, ChevronDown, Calendar as CalendarIcon, Settings, TrendingUp, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { useIsMobile } from '@/hooks/use-mobile';

const Financial = () => {
  const isMobile = useIsMobile();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummary | null>(null);
  const [yearlyPerformance, setYearlyPerformance] = useState<YearlyPerformance | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdown | null>(null);
  const [selectedDateRange, setSelectedDateRange] = useState<{ from: Date; to: Date }>({
    from: startOfMonth(new Date()),
    to: new Date()
  });
  const [incomeBreakdown, setIncomeBreakdown] = useState<CategoryBreakdown | null>(null);
  const [selectedEntityType, setSelectedEntityType] = useState<'all' | 'pf' | 'pj'>('pf');
  const [selectedMonth, setSelectedMonth] = useState<SelectedMonth | null>(null);
  const [yearTransactions, setYearTransactions] = useState<Transaction[]>([]);
  const fetchGeneration = useRef(0);
  const requestedMonthRef = useRef<SelectedMonth | null>(null);


  // Fetch financial data
  const loadData = useCallback(async () => {
    const gen = ++fetchGeneration.current;
    try {
      const naturezaFilter = selectedEntityType;

      await ContaRecorrenteService.generate(selectedDateRange.from, selectedDateRange.to)
        .catch(() => {});

      const [summary, yearly, categories, incomes, yearTx] = await Promise.all([
        FinancialService.getFinancialSummary(
          selectedDateRange,
          naturezaFilter
        ),
        FinancialService.getYearlyPerformance(
          new Date().getFullYear(),
          naturezaFilter
        ),
        FinancialService.getCategoryBreakdown(
          selectedDateRange,
          naturezaFilter,
          'saida'
        ),
        FinancialService.getCategoryBreakdown(
          selectedDateRange, 
          naturezaFilter, 
          'entrada'
        ),
        // Always fetch full-year transactions for yearly chart investment
        FinancialService.getYearTransactions(
          new Date().getFullYear(),
          naturezaFilter === 'all' ? undefined : naturezaFilter
        ),
      ]);

      // Only apply state if this is still the latest fetch generation
      if (gen !== fetchGeneration.current) return;

      setFinancialSummary(summary);
      setYearlyPerformance(yearly);
      setCategoryBreakdown(categories);
      setIncomeBreakdown(incomes);
      setTransactions(summary.transacoes);
      setYearTransactions(yearTx);

      // If a month was requested, activate the flip now that fresh data is loaded
      if (requestedMonthRef.current) {
        setSelectedMonth(requestedMonthRef.current);
        requestedMonthRef.current = null;
      }
    } catch (error) {
      if (gen === fetchGeneration.current) {
        console.error('Erro ao carregar dados:', error);
      }
    }
  }, [selectedDateRange, selectedEntityType]);

  useEffect(() => {
    loadData();
  }, [loadData]);


  // Monthly balance
  const monthlyBalance: MonthlyBalance = useMemo(() => {
    if (!financialSummary) return { income: 0, expenses: 0, balance: 0 };
    return {
      income: financialSummary.entradas,
      expenses: financialSummary.saidas,
      balance: financialSummary.entradas - financialSummary.saidas
    };
  }, [financialSummary]);

   // Yearly data
   const yearlyData: YearlyData[] = useMemo(() => {
     if (!yearlyPerformance?.meses) return [];
     const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
     // Prepare investment sums per month
      const investmentSums: Record<number, number> = {};
      yearTransactions.forEach(t => {
        if (t.tipo === 'investimento') {
          const date = new Date(t.data_transacao);
          const monthIdx = date.getMonth();
          investmentSums[monthIdx] = (investmentSums[monthIdx] || 0) + t.valor;
        }
      });
      // Object.entries preserves order defined by backend (janeiro, fevereiro…)
      return Object.entries(yearlyPerformance.meses).map(
        ([monthKey, vals], idx) => ({
          month: names[idx],
          income: vals.entrada,
          expenses: vals.saida,
          profit: vals.entrada - vals.saida,
          investment: investmentSums[idx] || 0
        })
      );
    }, [yearlyPerformance, yearTransactions]);

  // Handlers that reload data
  const handleAddTransaction = async (newTransaction: Transaction) => {
    await FinancialService.addTransaction(newTransaction);
    await loadData();
  };
  const handleEditTransaction = async (id: number, updated: Partial<Transaction>) => {
    await FinancialService.updateTransaction(id, updated);
    await loadData();
  };
  const handleDeleteTransaction = async (id: number) => {
    await FinancialService.deleteTransaction(id);
    await loadData();
  };

  const handleMonthSelect = useCallback((monthIndex: number, year: number) => {
    const from = new Date(year, monthIndex, 1);
    const to = endOfMonth(from);
    setSelectedDateRange({ from, to });
    const monthNames = [
      'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
    ];
    // Reset current flip and store the month in a ref
    // The flip will be activated inside loadData when fresh data arrives
    setSelectedMonth(null);
    requestedMonthRef.current = {
      name: monthNames[monthIndex],
      index: monthIndex,
      year,
    };
  }, []);

  const handleBackClick = useCallback(() => {
    setSelectedMonth(null);
    requestedMonthRef.current = null;
  }, []);

  // Filter and sort transactions
  const filteredTransactions = useMemo(
    () =>
      selectedEntityType === 'all'
        ? transactions
        : transactions.filter(t => t.natureza === selectedEntityType),
    [transactions, selectedEntityType]
  );
  const sortedTransactions = useMemo(
    () =>
      [...filteredTransactions].sort(
        (a, b) => new Date(b.data_transacao).getTime() - new Date(a.data_transacao).getTime()
      ),
    [filteredTransactions]
  );

  const currentPeriodExpenses = monthlyBalance.expenses;

  console.log('entrada', incomeBreakdown)

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <main className="max-w-[90vw] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 ">
        {/* Date Range Picker */}
        <div className="w-full flex justify-end mb-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full max-w-[260px] justify-start text-left font-normal",
                  "flex items-center gap-2 mb-4"
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

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-8 lg:h-[calc(100vh-200px)]">
          {/* Dashboard */}
          <div className="lg:col-span-3 animate-fade-in">
            <FinancialDashboard
              yearlyData={yearlyData}
              totalInvested={monthlyBalance?.balance || 0}
              monthlyGoal={financialSummary?.meta_mensal || 0}
              currentMonthExpenses={currentPeriodExpenses}
              dateRange={selectedDateRange}
              transactions={sortedTransactions}
              selectedMonth={selectedMonth}
              incomeBreakdown={incomeBreakdown}
              categoryBreakdown={categoryBreakdown}
              onMonthSelect={handleMonthSelect}
              onBackClick={handleBackClick}
              limiteCartaoCredito={financialSummary?.limite_cartao_credito || 0}
              gastosFixos={financialSummary?.gastos_fixos || 0}
              gastosVariaveis={financialSummary?.gastos_variaveis || 0}
            />
          </div>
          {/* Transactions List */}
          <div className="lg:col-span-2 animate-slide-up">
            <div className="bg-card rounded-lg shadow-card border border-border h-full">
              <TransactionList
                transactions={sortedTransactions}
                monthlyBalance={monthlyBalance}
                onAddTransaction={handleAddTransaction}
                onEditTransaction={handleEditTransaction}
                onDeleteTransaction={handleDeleteTransaction}
                dateRange={selectedDateRange}
                selectedEntityType={selectedEntityType}
                onEntityTypeChange={setSelectedEntityType}
                onReload={loadData}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Financial;
