
import { useMemo } from 'react';
import { Card } from 'primereact/card';
import { ProgressBar } from 'primereact/progressbar';
import { FlippableChart } from './FlippableChart';
import { IncomeChart } from './IncomeChart';
import { AnimatedNumber } from './AnimatedNumber';
import { TrendingUp, Send, CreditCard, Banknote } from 'lucide-react';
import {
  YearlyData,
  DailyData,
  SelectedMonth,
  CategoryExpense,
  CategoryBreakdown,
  Transaction,
} from '@/types/financial';

interface FinancialDashboardProps {
  yearlyData: YearlyData[];
  categoryBreakdown: CategoryBreakdown | null;
  totalInvested: number;
  monthlyGoal: number;
  currentMonthExpenses: number;
  dateRange: { from: Date; to: Date };
  transactions: (Transaction & { id: string })[];
  incomeBreakdown: any;
  selectedMonth: SelectedMonth | null;
  onMonthSelect?: (monthIndex: number, year: number) => void;
  onBackClick: () => void;
}

export function FinancialDashboard({
  yearlyData,
  categoryBreakdown,
  incomeBreakdown,
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
    const monthMap: Record<string, string> = {
      'Jan': 'Janeiro', 'Fev': 'Fevereiro', 'Mar': 'Marco', 'Abr': 'Abril',
      'Mai': 'Maio', 'Jun': 'Junho', 'Jul': 'Julho', 'Ago': 'Agosto',
      'Set': 'Setembro', 'Out': 'Outubro', 'Nov': 'Novembro', 'Dez': 'Dezembro',
    };
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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const pixTotal = transactions
    .filter(t => t.tipo === 'saida' && t.forma_pagamento === 'pix')
    .reduce((sum, t) => sum + t.valor, 0);

  const creditTotal = transactions
    .filter(t => t.tipo === 'saida' && t.forma_pagamento === 'credito')
    .reduce((sum, t) => sum + t.valor, 0);

  const debitTotal = transactions
    .filter(t => t.tipo === 'saida' && t.forma_pagamento === 'debito')
    .reduce((sum, t) => sum + t.valor, 0);

  console.log(categoryBreakdown)

  //Converter dados de categoria do payload para formato interno
  const dynamicCategoryExpenses: CategoryExpense[] = categoryBreakdown?.categorias
    ? categoryBreakdown.categorias
      .map((category, idx) => {
        if (category.total <= 0) return null;

        const barMax = category.limite > 0 ? category.limite : category.total;
        const hue = (idx * 40) % 360;

        // Converte array subcategorias (obj[] tipo {nome, valor}) em objeto Record<nome, number>
        const subcategoriesMap: Record<string, number> = {};
        category.subcategorias.forEach(sub => {
          subcategoriesMap[sub.nome] = parseFloat(sub.valor);
        });

        return {
          category: category.nome,
          amount: category.total,
          percentage: barMax > 0 ? (category.total / barMax) * 100 : 0,
          color: `hsl(${hue}, 60%, 55%)`,
          subcategories: {
            ...subcategoriesMap,
            total: category.total,
            limite: barMax
          }
        } as CategoryExpense;
      })
      .filter((item): item is CategoryExpense => item !== null)
    : [];



  return (
    <div className="space-y-6 h-full">
      {/* Métricas Principais */}
<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      <Card className="shadow-card border-none">
        <div className="p-4">
          <div className="w-full h-[350px]">
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
      </Card>

      {/* Layout em duas colunas para Gastos e Entradas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Entradas */}
        <Card className="shadow-card border-none">
          <IncomeChart
            breakdown={incomeBreakdown}
            dateRange={dateRange}
          />
        </Card>

        {/*Gastos por Categoria*/}
        <Card className="shadow-card border-none">
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-4">Gastos por Categoria</h3>
            {dynamicCategoryExpenses.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum gasto registrado para o período selecionado.
              </p>
            ) : (
              <div className="space-y-4">
                {dynamicCategoryExpenses.map((category, idxCat) => (
                  <div key={idxCat} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-4 h-4 rounded-sm"
                          style={{ backgroundColor: category.color }}
                        />
                        <span className="font-medium">{category.category}</span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">
                          {formatCurrency(category.amount)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {category.percentage.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="relative">
                      {category.subcategories &&
                        Object.entries(category.subcategories)
                          .filter(
                            ([sub, val]) =>
                              sub !== 'total' &&
                              sub !== 'limite' &&
                              (val as number) > 0
                          ).length > 0 ? (
                        <div className="flex h-3 rounded border border-border overflow-visible">
                          {Object.entries(category.subcategories)
                            .filter(
                              ([sub, val]) =>
                                sub !== 'total' &&
                                sub !== 'limite' &&
                                (val as number) > 0
                            )
                            .map(([subcat, amt], idxSub) => {
                              const amount = amt as number;
                              const widthPercent =
                                category.subcategories.limite > 0
                                  ? (amount / category.subcategories.limite) * 100
                                  : 0;
                              const hue = (idxSub * 60 + idxCat * 15) % 360;
                              const bgColor = `hsl(${hue},60%,55%)`;
                              return (
                                <div
                                  key={subcat}
                                  className="h-full relative group"
                                  style={{
                                    width: `${widthPercent}%`,
                                    backgroundColor: bgColor
                                  }}
                                >
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded shadow-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-auto max-w-[90vw]">
                                    <div className="font-medium">{subcat}</div>
                                    <div className="text-muted-foreground">
                                      {formatCurrency(amount)}
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          
                          {/* Área Restante do Limite */}
                          {category.subcategories.limite > category.amount && (
                             <div 
                                className="h-full bg-muted/30 relative group flex-1"
                                style={{ 
                                    width: `${Math.max(0, 100 - (category.amount / category.subcategories.limite * 100))}%`
                                }}
                             >
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded shadow-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-auto">
                                    <div className="font-medium text-success">Disponível</div>
                                    <div className="text-muted-foreground">
                                        {formatCurrency(category.subcategories.limite - category.amount)}
                                    </div>
                                </div>
                             </div>
                          )}
                        </div>
                      ) : (
                        <ProgressBar
                          value={category.percentage}
                          className="h-3 bg-gray-200"
                          showValue={false}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
