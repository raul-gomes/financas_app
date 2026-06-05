import { useMemo } from 'react';
import { Card } from 'primereact/card';
import { FlippableChart } from './FlippableChart';
import { IncomeChart } from './IncomeChart';
import { CategoryBreakdownSection } from './CategoryBreakdownSection';
import { AnimatedNumber } from './AnimatedNumber';
import { Send, CreditCard, Banknote, Receipt } from 'lucide-react';
import {
  YearlyData,
  DailyData,
  SelectedMonth,
  Transaction,
  CategoryBreakdown,
} from '@/types/financial';

interface FinancialDashboardProps {
  yearlyData: YearlyData[];
  totalInvested: number;
  monthlyGoal: number;
  currentMonthExpenses: number;
  dateRange: { from: Date; to: Date };
  transactions: (Transaction & { id: string })[];
  selectedMonth: SelectedMonth | null;
  incomeBreakdown: CategoryBreakdown | null;
  categoryBreakdown: CategoryBreakdown | null;
  onMonthSelect?: (monthIndex: number, year: number) => void;
  onBackClick: () => void;
  limiteCartaoCredito?: number;
  gastosFixos?: number;
  gastosVariaveis?: number;
}

export function FinancialDashboard({
  yearlyData,
  totalInvested,
  monthlyGoal,
  currentMonthExpenses,
  dateRange,
  transactions,
  selectedMonth,
  incomeBreakdown,
  categoryBreakdown,
  onMonthSelect,
  onBackClick,
  limiteCartaoCredito = 0,
  gastosFixos = 0,
  gastosVariaveis = 0,
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

  // Parcelas a Pagar
  const installmentItems = transactions.filter(
    t => t.total_parcelas && t.total_parcelas > 1 && t.parcela && t.parcela < t.total_parcelas
  );
  const totalParcelasRestantes = installmentItems.reduce(
    (sum, t) => sum + (t.total_parcelas! - t.parcela!) * t.valor, 0
  );
  const countParcelasRestantes = installmentItems.reduce(
    (sum, t) => sum + (t.total_parcelas! - t.parcela!), 0
  );

  return (
    <div className="flex flex-col h-full gap-4 overflow-y-auto">
      {/* Métricas Principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 flex-shrink-0">
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
            {limiteCartaoCredito > 0 && (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>{(creditTotal / limiteCartaoCredito * 100).toFixed(0)}% usado</span>
                  <span>Limite: R$ {limiteCartaoCredito.toLocaleString('pt-BR')}</span>
                </div>
                <div className="w-full bg-white/30 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      creditTotal > limiteCartaoCredito
                        ? 'bg-destructive'
                        : creditTotal > limiteCartaoCredito * 0.7
                        ? 'bg-warning'
                        : 'bg-success'
                    }`}
                    style={{ width: `${Math.min(100, (creditTotal / limiteCartaoCredito) * 100)}%` }}
                  />
                </div>
              </div>
            )}
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

        {/* Parcelas a Pagar */}
        <Card className="shadow-card border-none bg-warning/10">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Parcelas a Pagar</p>
                <p className="text-xl font-bold text-foreground">
                  <AnimatedNumber value={totalParcelasRestantes} withDelay={550} />
                </p>
                {countParcelasRestantes > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {countParcelasRestantes} parcela{countParcelasRestantes !== 1 ? 's' : ''} · {installmentItems.length} transação{installmentItems.length !== 1 ? 'ões' : ''}
                  </p>
                )}
              </div>
              <Receipt className="h-6 w-6 text-warning/70" />
            </div>
          </div>
        </Card>
      </div>

      {/* Grafico de Barras - Rendimento Anual / Diario */}
      <div className="shadow-card border-none rounded-lg bg-card flex-shrink-0" style={{ maxHeight: '420px' }}>
        <div className="px-4 py-2 h-[400px]">
          <FlippableChart
            yearlyData={yearlyData}
            dailyData={dailyData}
            monthlyGoal={monthlyGoal}
            selectedMonth={selectedMonth}
            onMonthClick={handleBarClick}
            onBackClick={onBackClick}
          />
        </div>
      </div>

      {/* Income + Category charts in a 2-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-shrink-0">
        <Card className="shadow-card border-none">
          <IncomeChart
            breakdown={incomeBreakdown}
            dateRange={dateRange}
          />
        </Card>
        <CategoryBreakdownSection
          categoryBreakdown={categoryBreakdown}
        />
      </div>

      {/* Gastos Fixos vs Variáveis */}
      <Card className="shadow-card border-none flex-shrink-0">
        <div className="p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3">Gastos Fixos vs Variáveis</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span className="text-success font-medium">Fixos: R$ {gastosFixos.toLocaleString('pt-BR')}</span>
                <span className="text-warning font-medium">Variáveis: R$ {gastosVariaveis.toLocaleString('pt-BR')}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 flex overflow-hidden">
                <div
                  className="bg-success transition-all duration-700 ease-out"
                  style={{
                    width: `${gastosFixos + gastosVariaveis > 0
                      ? (gastosFixos / (gastosFixos + gastosVariaveis)) * 100
                      : 0}%`
                  }}
                />
                <div
                  className="bg-warning transition-all duration-700 ease-out"
                  style={{
                    width: `${gastosFixos + gastosVariaveis > 0
                      ? (gastosVariaveis / (gastosFixos + gastosVariaveis)) * 100
                      : 0}%`
                  }}
                />
              </div>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-sm font-bold">
                R$ {(gastosFixos + gastosVariaveis).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
