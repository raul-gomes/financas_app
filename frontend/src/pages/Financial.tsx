import { useState, useMemo, useEffect, useCallback } from 'react';
import { TransactionList } from '@/components/TransactionList';
import { FinancialDashboard } from '@/components/FinancialDashboard';
import {
  Transaction,
  MonthlyBalance,
  YearlyData,
  FinancialSummary,
  YearlyPerformance,
  CategoryBreakdown
} from '@/types/financial';
import { FinancialService } from '@/services/financialService';
import { BarChart3, ChevronDown, Calendar as CalendarIcon, Settings, TrendingUp, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format, startOfMonth } from 'date-fns';

const Financial = () => {
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


  // Fetch financial data
  const loadData = useCallback(async () => {
    try {
      const naturezaFilter = selectedEntityType === 'all' ? undefined : selectedEntityType;

      const [summary, yearly, categories, incomes] = await Promise.all([
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
        )
      ]);

      setFinancialSummary(summary);
      setYearlyPerformance(yearly);
      setCategoryBreakdown(categories);
      setIncomeBreakdown(incomes);
      setTransactions(summary.transacoes);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
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
    // Object.entries preserva a ordem definida pelo backend (janeiro, fevereiro…)
    return Object.entries(yearlyPerformance.meses).map(
      ([monthKey, vals], idx) => ({
        month: names[idx],
        income: vals.entrada,
        expenses: vals.saida,
        profit: vals.entrada - vals.saida
      })
    );
  }, [yearlyPerformance]);

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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 ">
        {/* Date Range Picker */}
        <div className="w-full flex justify-end mb-4">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-[260px] justify-start text-left font-normal",
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
                numberOfMonths={2}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 h-[calc(100vh-200px)]">
          {/* Dashboard */}
          <div className="lg:col-span-3 animate-fade-in">
            <FinancialDashboard
              yearlyData={yearlyData}
              categoryBreakdown={categoryBreakdown}
              incomeBreakdown={incomeBreakdown}
              totalInvested={monthlyBalance?.balance || 0}
              monthlyGoal={financialSummary?.meta_mensal || 0}
              currentMonthExpenses={currentPeriodExpenses}
              dateRange={selectedDateRange}
              transactions={sortedTransactions}
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
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Financial;
