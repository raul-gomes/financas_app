import { useMemo } from 'react';
import { Card } from 'primereact/card';
import { FlippableChart } from './FlippableChart';
import { AnimatedNumber } from './AnimatedNumber';
import { Send, CreditCard, Banknote } from 'lucide-react';
import {
  YearlyData,
  DailyData,
  SelectedMonth,
  Transaction,
} from '@/types/financial';

interface FinancialDashboardProps {
  yearlyData: YearlyData[];
  totalInvested: number;
  monthlyGoal: number;
  currentMonthExpenses: number;
  dateRange: { from: Date; to: Date };
  transactions: (Transaction & { id: string })[];
  selectedMonth: SelectedMonth | null;
  onMonthSelect?: (monthIndex: number, year: number) => void;
  onBackClick: () => void;
}

export function FinancialDashboard({
  yearlyData,
  totalInvested,
  monthlyGoal,
  currentMonthExpenses,
  dateRange,
  transactions,
  selectedMonth,
  onMonthSelect,
  onBackClick,
}: FinancialDashboardProps) {
  const handleBarClick = (month: string) => {
    const monthIndexMap: Record<string, number> = {
      'Jan': 0, 'Fev': 1, 'Mar': 2, 'Abr': 3, 'Mai': 4, 'Jun': 5,
      'Jul': 6, 'Ago': 7, 'Set': 8, 'Out': 9, 'Nov': 10, 'Dez': 11,
    };
    const monthIndex = monthIndexMap[month];
    if (monthIndex !== undefined && onMonthSelect) {
      const currentYear = new Date().getFullYear();
      onMonthSelect(monthIndex, currentYear);
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
      const date = new Date(t.data_transacao);
      if (date.getMonth() === selectedMonth.index && date.getFullYear() === selectedMonth.year) {
        const dayIdx = date.getDate() - 1;
        if (t.tipo === 'entrada') days[dayIdx].income += t.valor;
        else if (t.tipo === 'saida') days[dayIdx].expenses += t.valor;
        else if (t.tipo === 'investimento') days[dayIdx].investment += t.valor;
      }
    });

    return days;
  }, [transactions, selectedMonth]);

  const pixTotal = transactions
    .filter(t => t.tipo === 'saida' && t.forma_pagamento === 'pix')
    .reduce((sum, t) => sum + t.valor, 0);

  const creditTotal = transactions
    .filter(t => t.tipo === 'saida' && t.forma_pagamento === 'credito')
    .reduce((sum, t) => sum + t.valor, 0);

  const debitTotal = transactions
    .filter(t => t.tipo === 'saida' && t.forma_pagamento === 'debito')
    .reduce((sum, t) => sum + t.valor, 0);

  return (
    <div className="flex flex-col h-full gap-4">
      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 flex-shrink-0">
        {/* Pix Card */}
        <Card className="shadow-card border-none bg-primary/10">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Pix</p>
                <p className="text-xl font-bold text-foreground">
                  <AnimatedNumber value={pixTotal} withDelay={100} />
                </p>
              </div>
              <Send className="h-6 w-6 text-primary/70" />
            </div>
          </div>
        </Card>

        {/* Cartão de Crédito Card */}
        <Card className="shadow-card border-none bg-success/10">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Cartão de Crédito</p>
                <p className="text-xl font-bold text-foreground">
                  <AnimatedNumber value={creditTotal} withDelay={250} />
                </p>
              </div>
              <CreditCard className="h-6 w-6 text-success/70" />
            </div>
          </div>
        </Card>

        {/* Cartão de Débito Card */}
        <Card className="shadow-card border-none bg-destructive/10">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Cartão de Débito</p>
                <p className="text-xl font-bold text-foreground">
                  <AnimatedNumber value={debitTotal} withDelay={400} />
                </p>
              </div>
              <Banknote className="h-6 w-6 text-destructive/70" />
            </div>
          </div>
        </Card>
      </div>

      {/* Grafico de Barras - Rendimento Anual / Diario */}
      <Card className="shadow-card border-none flex-1 min-h-0">
        <div className="px-4 py-2 h-full">
          <FlippableChart
            yearlyData={yearlyData}
            dailyData={dailyData}
            monthlyGoal={monthlyGoal}
            selectedMonth={selectedMonth}
            onMonthClick={handleBarClick}
            onBackClick={onBackClick}
          />
        </div>
      </Card>
    </div>
  );
}
