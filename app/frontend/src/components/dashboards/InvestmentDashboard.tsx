import { Card } from 'primereact/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { D3LineChart } from '@/components/charts/D3LineChart';
import { D3HorizontalBarChart } from '@/components/charts/D3HorizontalBarChart';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { TrendingUp, DollarSign, PiggyBank, Building2, TrendingDown, BarChart3 } from 'lucide-react';
import { Investment, PortfolioEvolution } from '@/types/financial';

interface InvestmentDashboardProps {
  investments: Investment[];
  portfolioEvolution: PortfolioEvolution[];
}

export function InvestmentDashboard({
  investments,
  portfolioEvolution
}: InvestmentDashboardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'BRL'
    }).format(amount);
  };

  const formatPercentage = (percentage: number) => {
    const sign = percentage >= 0 ? '+' : '';
    return `${sign}${percentage.toFixed(2)}%`;
  };

  // Calcular métricas
  const totalInvested = investments.reduce((sum, inv) => sum + inv.totalValue, 0);
  const totalProfit = investments.reduce((sum, inv) => sum + inv.profit, 0);
  const totalProfitPercentage = totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0;
  
  // FIIs específicos
  const fiisInvestments = investments.filter(inv => inv.category === 'FIIs');
  const fiisTotal = fiisInvestments.reduce((sum, inv) => sum + inv.totalValue, 0);
  const fiisProfit = fiisInvestments.reduce((sum, inv) => sum + inv.profit, 0);

  // Separar por tipo
  const rendaVariavel = investments.filter(inv => inv.type === 'variavel');
  const rendaFixa = investments.filter(inv => inv.type === 'fixa');

  // Dados para o gráfico de pizza por categoria
  const categoryData = investments.reduce((acc, inv) => {
    const existing = acc.find(item => item.category === inv.category);
    if (existing) {
      existing.value += inv.totalValue;
    } else {
      acc.push({
        category: inv.category,
        value: inv.totalValue,
        color: getCategoryColor(inv.category)
      });
    }
    return acc;
  }, [] as Array<{category: string, value: number, color: string}>);

  function getCategoryColor(category: string): string {
    const colors: Record<string, string> = {
      'Ações': 'hsl(var(--muted-foreground))',
      'FIIs': 'hsl(var(--primary))', 
      'ETFs': 'hsl(var(--secondary))',
      'Criptomoedas': 'hsl(var(--accent))',
      'CDB': 'hsl(var(--muted))',
      'LCI': 'hsl(var(--chart-1))',
      'LCA': 'hsl(var(--chart-2))',
      'Tesouro Direto': 'hsl(var(--chart-3))',
      'Debêntures': 'hsl(var(--chart-4))'
    };
    return colors[category] || 'hsl(var(--muted))';
  }

  const InvestmentTable = ({ investments, type }: { investments: Investment[], type: string }) => (
    <div className="space-y-3">
      {investments.map((investment) => (
        <div key={investment.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
          <div className="flex-1">
            <p className="font-medium text-foreground">{investment.name}</p>
            <p className="text-xs text-muted-foreground">{investment.category}</p>
          </div>
          <div className="text-right">
            <p className="font-semibold text-foreground">{formatCurrency(investment.totalValue)}</p>
            <p className={`text-xs ${investment.profit >= 0 ? 'text-success' : 'text-destructive'}`}>
              {formatPercentage(investment.profitPercentage)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-6 h-full">
      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-card border-none bg-success/10">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Total Investido</p>
                <p className="text-lg font-bold text-success">
                  <AnimatedNumber value={totalInvested} withDelay={100} />
                </p>
                <p className={`text-xs ${totalProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatPercentage(totalProfitPercentage)}
                </p>
              </div>
              <PiggyBank className="h-6 w-6 text-success/70" />
            </div>
          </div>
        </Card>

        <Card className="shadow-card border-none bg-primary/10">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Renda de FIIs</p>
                <p className="text-lg font-bold text-foreground">
                  <AnimatedNumber value={fiisTotal} withDelay={250} />
                </p>
                <p className={`text-xs ${fiisProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  {formatCurrency(fiisProfit)}
                </p>
              </div>
              <Building2 className="h-6 w-6 text-muted-foreground" />
            </div>
          </div>
        </Card>

        <Card className="shadow-card border-none bg-warning/10">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Lucro/Prejuízo</p>
                <p className={`text-lg font-bold ${totalProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                  <AnimatedNumber value={totalProfit} withDelay={400} />
                </p>
                <p className="text-xs text-muted-foreground">
                  {totalProfit >= 0 ? 'Lucro' : 'Prejuízo'}
                </p>
              </div>
              {totalProfit >= 0 ? 
                <TrendingUp className="h-6 w-6 text-success" /> :
                <TrendingDown className="h-6 w-6 text-destructive" />
              }
            </div>
          </div>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="space-y-6">
        {/* Gráfico de Evolução da Carteira */}
        <Card className="shadow-card border-none">
          <div className="p-6">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <TrendingUp className="h-5 w-5" />
              Evolução da Carteira
            </h3>
            <D3LineChart 
              data={portfolioEvolution}
              width={undefined}
              height={300}
            />
          </div>
        </Card>

        {/* Gráfico de Distribuição por Categoria */}
        <Card className="shadow-card border-none">
          <div className="p-6">
            <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5" />
              Investido por Categoria
            </h3>
            <D3HorizontalBarChart 
              data={categoryData}
              width={undefined}
              height={280}
            />
          </div>
        </Card>
      </div>

      {/* Lista de Investimentos */}
      <Card className="shadow-card border-none">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Investimentos por Categoria</h3>
          <Tabs defaultValue="variavel" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="variavel">Renda Variável</TabsTrigger>
              <TabsTrigger value="fixa">Renda Fixa</TabsTrigger>
            </TabsList>
            <TabsContent value="variavel" className="mt-4">
              <InvestmentTable investments={rendaVariavel} type="variavel" />
            </TabsContent>
            <TabsContent value="fixa" className="mt-4">
              <InvestmentTable investments={rendaFixa} type="fixa" />
            </TabsContent>
          </Tabs>
        </div>
      </Card>
    </div>
  );
}