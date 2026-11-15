import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { StatCard } from '@/components/ui/stat-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ArrowDownCircle, ArrowUpCircle, Coins, CreditCard, Target, ShoppingCart, Receipt, CalendarClock, TrendingDown, TrendingUp } from 'lucide-react';
import { useOverviewQuery, type OverviewEntityType } from '@/hooks/queries/useOverviewQuery';
import { formatCurrency } from '@/lib/format';
import { paymentMethodLabel } from '@/lib/transactionLabels';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { MobileTopBarSlot } from '@/components/layout/MobileTopBar';
import { MonthStepper } from '@/components/layout/MonthStepper';
import { OverviewMobile } from '@/components/dashboards/OverviewMobile';

type EntityTypeFilter = 'pf' | 'pj' | 'all';

interface OverviewDashboardProps {
  isAdmin?: boolean;
}

const ENTITY_LABEL: Record<string, string> = {
  individual: 'PF',
  business: 'PJ',
};

export function OverviewDashboard({ isAdmin = false }: OverviewDashboardProps) {
  const isMobile = useIsMobile();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [entityType, setEntityType] = useState<EntityTypeFilter>('all');
  const entityParam: OverviewEntityType =
    entityType === 'pf' ? 'individual' : entityType === 'pj' ? 'business' : 'all';
  const { data, isPending } = useOverviewQuery(year, month, entityParam, isAdmin);

  const changeMonth = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth() + 1);
  };

  const monthName = new Date(year, month - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

  // Mobile: the month stepper lives in the top bar; the body is the card layout of the mock
  const mobileMonthStepper = (
    <MobileTopBarSlot>
      <MonthStepper
        year={year}
        month={month}
        onChange={(next) => {
          setYear(next.year);
          setMonth(next.month);
        }}
      />
    </MobileTopBarSlot>
  );

  if (isPending) {
    return (
      <div className="space-y-4">
        {isMobile && mobileMonthStepper}
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
            <div className="h-4 w-1/3 rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) {
    return <EmptyState title="Erro ao carregar o dashboard" description="Não foi possível carregar os dados gerais." />;
  }

  if (isMobile) {
    return (
      <>
        {mobileMonthStepper}
        <OverviewMobile data={data} entityType={entityType} onEntityTypeChange={setEntityType} isAdmin={isAdmin} />
      </>
    );
  }

  const { totals, month_progress: mp, credit_card, categories_status, installments, recurring_accounts, goals, shopping } = data;

  const statusBadge = (status: string) => {
    if (status === 'over') return <Badge variant="destructive">Estourado</Badge>;
    if (status === 'warning') return <Badge variant="warning">Para estourar</Badge>;
    return <Badge variant="secondary">OK</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho com navegação de mês e toggle PF/PJ */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => changeMonth(-1)} aria-label="Mês anterior">
            ‹
          </Button>
          <span className="text-lg font-medium capitalize">{monthName}</span>
          <Button variant="outline" size="sm" onClick={() => changeMonth(1)} aria-label="Próximo mês">
            ›
          </Button>
        </div>
        <div className="flex items-center bg-muted rounded-lg p-1">
          <button
            onClick={() => setEntityType('all')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              entityType === 'all' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            Ambos
          </button>
          <button
            onClick={() => setEntityType('pf')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              entityType === 'pf' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            PF
          </button>
          <button
            onClick={() => setEntityType('pj')}
            className={cn(
              'px-4 py-1.5 text-sm font-medium rounded-md transition-colors',
              entityType === 'pj' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            PJ
          </button>
        </div>
      </div>

      {/* Indicadores principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={ArrowUpCircle}
          label="Entradas"
          value={formatCurrency(totals.total_income)}
          hint={`Até hoje: ${formatCurrency(mp.income_up_to_today)}`}
          tone="success"
        />
        <StatCard
          icon={ArrowDownCircle}
          label="Saídas"
          value={formatCurrency(totals.total_expenses)}
          hint={`Até hoje: ${formatCurrency(mp.expenses_up_to_today)}`}
          tone="destructive"
        />
        <StatCard
          icon={Coins}
          label="Saldo"
          value={formatCurrency(totals.balance)}
          hint={`Dia ${mp.day}/${mp.days_in_month}`}
          tone="default"
        />
        <StatCard
          icon={CreditCard}
          label="Cartão"
          value={
            <span className="flex items-center gap-2">
              {Math.round(credit_card.percent_used)}%
              {credit_card.percent_used >= 100 && (
                <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">Estourando</span>
              )}
            </span>
          }
          hint={`${formatCurrency(credit_card.used)} de ${formatCurrency(credit_card.limit)}`}
          tone={credit_card.percent_used >= 100 ? 'destructive' : credit_card.percent_used >= 80 ? 'warning' : 'success'}
        />
      </div>

      {/* Progresso do mês até hoje */}
      <Card className="shadow-card border-none p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-medium text-muted-foreground">
            {mp.day} de {mp.days_in_month} dias ({Math.round(mp.percent * 100)}% do mês)
          </p>
          <span className="text-sm font-semibold">{formatCurrency(mp.balance)}</span>
        </div>
        <div className="w-full bg-secondary rounded-full h-3 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-700',
              mp.percent >= 0.7 ? 'bg-warning' : 'bg-primary',
            )}
            style={{ width: `${Math.min(100, mp.percent * 100)}%` }}
          />
        </div>
      </Card>

      {/* Categorias com limite perto de estourar / estouradas */}
      {categories_status.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Categorias com limite
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {categories_status.map((c) => (
              <Card key={c.id} className="shadow-card border-none p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{c.category_name}</p>
                  {statusBadge(c.status)}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ENTITY_LABEL[c.entity_type] ?? c.entity_type} · {Math.round(c.percent_used)}% ({formatCurrency(c.limit)})
                </p>
                <div className="mt-2 w-full bg-secondary rounded-full h-2 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all',
                      c.status === 'over' ? 'bg-destructive' : c.status === 'warning' ? 'bg-warning' : 'bg-success',
                    )}
                    style={{ width: `${Math.min(100, c.percent_used)}%` }}
                  />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Parcelas do mês + Contas recorrentes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="shadow-card border-none p-4">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Parcelas do mês</h2>
          </div>
          {installments.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma parcela neste mês.</p>
          ) : (
            <ul className="space-y-3">
              {installments.map((p) => (
                <li key={p.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{p.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {paymentMethodLabel(p.payment_method)} · {p.installment_number}/{p.total_installments}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="shadow-card border-none p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Recorrentes a pagar</h2>
          </div>
          {recurring_accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma conta recorrente neste mês.</p>
          ) : (
            <ul className="space-y-3">
              {recurring_accounts.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">
                      {r.description}
                      {r.is_ending_soon && <Badge variant="warning" className="ml-2">Acabando</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Vence dia {r.due_day} · {r.current_installment}/{r.total_installments}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{formatCurrency(r.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Metas + Compras (somente admin) */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="shadow-card border-none p-4">
            <div className="flex items-center gap-2 mb-3">
              <Target className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Metas</h2>
            </div>
            {goals.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma meta definida.</p>
            ) : (
              <ul className="space-y-3">
                {goals.map((g) => (
                  <li key={g.subcategory_id}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{g.subcategory_name}</span>
                      <span className="text-xs text-muted-foreground">{Math.round(g.progress)}%</span>
                    </div>
                    <div className="mt-1 w-full bg-secondary rounded-full h-2 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full', g.progress >= 100 ? 'bg-success' : 'bg-primary')}
                        style={{ width: `${Math.min(100, g.progress)}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatCurrency(g.current_amount)} de {formatCurrency(g.target_amount)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="shadow-card border-none p-4">
            <div className="flex items-center gap-2 mb-3">
              <ShoppingCart className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Compras</h2>
            </div>
            {shopping.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma compra para este mês.</p>
            ) : (
              <ul className="space-y-3">
                {shopping.map((s) => (
                  <li key={s.id} className="flex items-center justify-between">
                    <span className="text-sm font-medium">{s.name}</span>
                    <Badge variant={s.checked ? 'secondary' : 'default'}>
                      {s.checked ? 'Comprado' : 'Pendente'}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {/* Rodapé com investimentos do mês */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <TrendingUp className="h-4 w-4" /> Investido no mês: <strong className="text-foreground">{formatCurrency(totals.total_invested)}</strong>
        </span>
        <span className="flex items-center gap-1">
          <TrendingDown className="h-4 w-4" /> Saldo até hoje: <strong className="text-foreground">{formatCurrency(mp.balance)}</strong>
        </span>
      </div>
    </div>
  );
}