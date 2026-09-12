import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { BarChart3, DollarSign, TrendingUp } from 'lucide-react';
import { useRole } from '@/contexts/RoleContext';
import { OverviewDashboard } from '@/components/dashboards/OverviewDashboard';

export default function Index() {
  const { isAdmin } = useRole();
  return (
    <div className="min-h-screen bg-gradient-subtle px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Visão Geral</h1>
            <p className="text-muted-foreground">Seu controle financeiro em um só lugar</p>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/financial">
              <Button variant="outline">
                <DollarSign className="h-4 w-4 mr-2" />
                Financeiro
              </Button>
            </Link>
            {isAdmin && (
              <Link to="/investments">
                <Button variant="outline">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Investimentos
                </Button>
              </Link>
            )}
            <Link to="/configuracoes">
              <Button variant="outline">
                <BarChart3 className="h-4 w-4 mr-2" />
                Configurações
              </Button>
            </Link>
          </div>
        </div>

        <OverviewDashboard isAdmin={isAdmin} />
      </div>
    </div>
  );
}