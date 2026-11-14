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
        </div>

        <OverviewDashboard isAdmin={isAdmin} />
      </div>
    </div>
  );
}