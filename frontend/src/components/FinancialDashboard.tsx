
import { Card } from 'primereact/card';
import { Tag } from 'primereact/tag';
import { ProgressBar } from 'primereact/progressbar';
import { D3BarChart } from './D3BarChart';
import { IncomeChart } from './IncomeChart';
import { TrendingUp, DollarSign, PiggyBank, Target, BarChart, Info } from 'lucide-react';
import { YearlyData, CategoryExpense, CategoryBreakdown, Transaction } from '@/types/financial';
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface FinancialDashboardProps {
  yearlyData: YearlyData[];
  categoryBreakdown: CategoryBreakdown | null;
  totalInvested: number;
  monthlyGoal: number;
  currentMonthExpenses: number;
  dateRange: { from: Date, to: Date };
  transactions: (Transaction & { id: string })[];
  incomeBreakdown: any
}

export function FinancialDashboard({
  yearlyData,
  categoryBreakdown,
  incomeBreakdown,
  totalInvested,
  monthlyGoal,
  currentMonthExpenses,
  dateRange,
  transactions
}: FinancialDashboardProps) {
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const handleBarClick = (month: string) => {
    console.log("Mês selecionado no gráfico:", month);
    setSelectedMonth(month);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const goalProgress = monthlyGoal > 0 ? (currentMonthExpenses / monthlyGoal) * 100 : 0;
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

  const saldoClass = totalInvested >= 0 ? 'text-green-600' : 'text-red-600';

  return (
    <div className="space-y-6 h-full">
      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-card border-none bg-success/10">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Investido</p>
                <p className={`text-xl font-bold ${saldoClass}`}>{formatCurrency(totalInvested)}</p>
              </div>
              <PiggyBank className="h-6 w-6 text-success/70" />
            </div>
          </div>
        </Card>

        <Card className="shadow-card border-none bg-primary/10">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Meta Mensal</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(monthlyGoal)}</p>
                <Tag
                  severity={goalProgress > 100 ? 'danger' : 'info'}
                  value={`${goalProgress.toFixed(1)}% usado`}
                  className="mt-1 text-xs px-2 py-1"
                />
              </div>
              <Target className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
        </Card>

        <Card className="shadow-card border-none bg-destructive/10">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Gastos do Mês</p>
                <p className="text-xl font-bold text-foreground">{formatCurrency(currentMonthExpenses)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Restam {formatCurrency(Math.max(0, monthlyGoal - currentMonthExpenses))}
                </p>
              </div>
              <DollarSign className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
        </Card>
      </div>

      {/* Gráfico de Barras - Rendimento Anual */}
      <Card className="shadow-card border-none">
        <div className="p-4">
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
            <BarChart className="h-5 w-5" />
            Rendimento do Período
          </h3>
          <div className="w-full h-[350px] overflow-hidden">
            <D3BarChart
              data={yearlyData}
              width={900}     // largura do viewBox
              height={350}    // altura do viewBox
              monthlyGoal={monthlyGoal}
              onBarClick={handleBarClick}
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
                                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded shadow-lg text-xs opacity-0 group-hover:opacity-100 transition-opacity z-10 whitespace-nowrap pointer-events-auto">
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

      {/* Modal de Detalhes do Mês */}
      <Dialog open={!!selectedMonth} onOpenChange={() => setSelectedMonth(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <BarChart className="h-6 w-6 text-primary" />
              Operações de {selectedMonth ? selectedMonth.charAt(0).toUpperCase() + selectedMonth.slice(1) : ''}
            </DialogTitle>
          </DialogHeader>
          
          <div className="flex-1 overflow-y-auto mt-4 border rounded-md">
            <Table>
              <TableHeader className="bg-muted/50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions
                  .filter(t => {
                    if (!selectedMonth) return false;
                    const date = new Date(t.data_transacao);
                    // Compara com o nome do mês em inglês e português para cobrir as possibilidades do D3
                    const monthNameEn = date.toLocaleString('en-US', { month: 'long' }).toLowerCase();
                    const monthNamePt = date.toLocaleString('pt-BR', { month: 'long' }).toLowerCase();
                    return monthNameEn === selectedMonth.toLowerCase() || monthNamePt === selectedMonth.toLowerCase();
                  })
                  .sort((a,b) => new Date(b.data_transacao).getTime() - new Date(a.data_transacao).getTime())
                  .map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {new Date(t.data_transacao).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <div>
                          {t.descricao}
                          {t.total_parcelas && t.total_parcelas > 1 && (
                            <div className="text-[10px] text-muted-foreground">
                              Parcela {t.parcela || '1'}/{t.total_parcelas}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{t.categoria_nome}</span>
                          <span className="text-[10px] text-muted-foreground">{t.subcategoria_nome}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.tipo === 'entrada' ? 'secondary' : 'destructive'} className="capitalize">
                          {t.tipo}
                        </Badge>
                      </TableCell>
                      <TableCell className={`text-right font-bold ${t.tipo === 'entrada' ? 'text-green-600' : 'text-red-500'}`}>
                        {t.tipo === 'saida' ? '- ' : '+ '}
                        {formatCurrency(t.valor)}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
