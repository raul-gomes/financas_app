import { useState } from 'react';
import { Link } from 'react-router';
import { Card } from '@/components/ui/card';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { OverviewResponse } from '@/types/overview';

type EntityScope = 'pf' | 'pj' | 'all';

/** Items shown in a long list before "Ver tudo". */
const COLLAPSED_ITEM_COUNT = 3;

/** Bar and pill token classes per limit status (full class names so Tailwind generates them). */
const STATUS_TONE = {
  over: { bar: 'bg-destructive', pill: 'bg-destructive/15 text-destructive' },
  warning: { bar: 'bg-warning', pill: 'bg-warning/15 text-warning' },
  ok: { bar: 'bg-success', pill: 'bg-success/15 text-success' },
} as const;

const SCOPE_OPTIONS = [
  { value: 'all', label: 'Ambos' },
  { value: 'pf', label: 'PF' },
  { value: 'pj', label: 'PJ' },
] as const;

interface OverviewMobileProps {
  data: OverviewResponse;
  entityType: EntityScope;
  onEntityTypeChange: (scope: EntityScope) => void;
  isAdmin: boolean;
}

/** Progress bar track + fill; `tone` is a background token class. */
function Bar({ percent, tone }: { percent: number; tone: string }) {
  return (
    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-secondary">
      <div className={cn('h-full rounded-full', tone)} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
    </div>
  );
}

interface ListCardProps<T> {
  title: string;
  testId: string;
  items: readonly T[];
  empty: string;
  render: (item: T) => React.ReactNode;
  /** Link shown instead of the expand toggle (the list lives on another page). */
  action?: React.ReactNode;
}

/** Card with a list capped at `COLLAPSED_ITEM_COUNT` items and a "Ver tudo" / "Ver menos" toggle. */
function ListCard<T>({ title, testId, items, empty, render, action }: ListCardProps<T>) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, COLLAPSED_ITEM_COUNT);
  const canExpand = items.length > COLLAPSED_ITEM_COUNT;
  return (
    <Card data-testid={testId} className="border-none p-4 shadow-card">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        {action ??
          (canExpand && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="-mr-2 min-h-[44px] px-2 text-[13px] font-semibold text-primary"
            >
              {expanded ? 'Ver menos' : 'Ver tudo'}
            </button>
          ))}
      </div>
      {items.length === 0 ? (
        <p className="py-2 text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul>{visible.map(render)}</ul>
      )}
    </Card>
  );
}

const rowClass = 'flex min-h-[52px] items-center gap-3 border-t border-border first:border-t-0';

/** "MM/YYYY" reference month -> its two-digit month ("11"). */
function monthOf(referenceMonth: string): string {
  return referenceMonth.split('/')[0];
}

/**
 * The home page below `md`: scope selector, hero balance card, month progress with
 * the credit card usage, categories near their limit, bills to pay, and (admins)
 * goals and shopping. The month stepper lives in the top bar (the parent renders it).
 */
export function OverviewMobile({ data, entityType, onEntityTypeChange, isAdmin }: OverviewMobileProps) {
  const { totals, month_progress: progress, credit_card: card, categories_status, installments, recurring_accounts, goals, shopping } = data;
  const nearLimit = [...categories_status].sort((a, b) => b.percent_used - a.percent_used).slice(0, COLLAPSED_ITEM_COUNT);
  const month = monthOf(data.reference_month);

  return (
    <div className="space-y-3">
      <SegmentedControl aria-label="Tipo de conta" options={SCOPE_OPTIONS} value={entityType} onChange={onEntityTypeChange} fill />

      <Card data-testid="hero-balance" className="border-0 bg-primary p-4 text-primary-foreground shadow-card">
        <p className="text-xs opacity-85">Saldo do mês</p>
        <p className="text-3xl font-extrabold tracking-tight">{formatCurrency(totals.balance)}</p>
        <div className="mt-3 grid grid-cols-2 gap-2.5">
          <div className="rounded-xl bg-primary-foreground/15 px-2.5 py-2">
            <p className="text-xs opacity-85">Entradas</p>
            <p className="text-sm font-bold">{formatCurrency(totals.total_income)}</p>
          </div>
          <div className="rounded-xl bg-primary-foreground/15 px-2.5 py-2">
            <p className="text-xs opacity-85">Saídas</p>
            <p className="text-sm font-bold">{formatCurrency(totals.total_expenses)}</p>
          </div>
        </div>
      </Card>

      <Card data-testid="month-progress" className="border-none p-4 shadow-card">
        <div className="flex items-center justify-between text-sm font-bold text-foreground">
          <span>
            Dia {progress.day} de {progress.days_in_month}
          </span>
          <span>{Math.round(progress.percent * 100)}%</span>
        </div>
        <Bar percent={progress.percent * 100} tone={progress.percent >= 0.7 ? 'bg-warning' : 'bg-primary'} />
        <p className="mt-2 text-xs text-muted-foreground">
          Cartão: {formatCurrency(card.used)} de {formatCurrency(card.limit)}
        </p>
      </Card>

      {nearLimit.length > 0 && (
        <Card data-testid="near-limit" className="border-none p-4 shadow-card">
          <div className="mb-1 flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">Perto do limite</h2>
            <Link to="/limits" className="-mr-2 flex min-h-[44px] items-center px-2 text-[13px] font-semibold text-primary">
              Ver limites
            </Link>
          </div>
          <ul>
            {nearLimit.map((c) => {
              const tone = STATUS_TONE[c.status];
              return (
                <li key={c.id} className={cn(rowClass, 'py-2')}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{c.category_name}</p>
                    <Bar percent={c.percent_used} tone={tone.bar} />
                  </div>
                  <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', tone.pill)}>
                    {Math.round(c.percent_used)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      <ListCard
        title="A pagar este mês"
        testId="to-pay"
        items={recurring_accounts}
        empty="Nenhuma conta recorrente neste mês."
        render={(r) => (
          <li key={r.id} className={rowClass}>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{r.description}</p>
              <p className="text-xs text-muted-foreground">
                vence {String(r.due_day).padStart(2, '0')}/{month} · Recorrente
                {r.is_ending_soon ? ' · acabando' : ''}
              </p>
            </div>
            <span className="whitespace-nowrap text-sm font-bold text-foreground">{formatCurrency(r.amount)}</span>
          </li>
        )}
      />

      {installments.length > 0 && (
        <ListCard
          title="Parcelas do mês"
          testId="installments"
          items={installments}
          empty="Nenhuma parcela neste mês."
          render={(p) => (
            <li key={p.id} className={rowClass}>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold text-foreground">{p.description}</p>
                <p className="text-xs text-muted-foreground">
                  {p.installment_number}/{p.total_installments}
                </p>
              </div>
              <span className="whitespace-nowrap text-sm font-bold text-foreground">{formatCurrency(p.amount)}</span>
            </li>
          )}
        />
      )}

      {isAdmin && (
        <>
          <ListCard
            title="Metas"
            testId="goals"
            items={goals}
            empty="Nenhuma meta definida."
            render={(g) => (
              <li key={g.subcategory_id} className="border-t border-border py-3 first:border-t-0">
                <div className="flex items-center justify-between text-sm">
                  <span className="min-w-0 truncate font-semibold text-foreground">{g.subcategory_name}</span>
                  <span className="text-xs text-muted-foreground">{Math.round(g.progress)}%</span>
                </div>
                <Bar percent={g.progress} tone={g.progress >= 100 ? 'bg-success' : 'bg-primary'} />
                <p className="mt-1 text-xs text-muted-foreground">
                  {formatCurrency(g.current_amount)} de {formatCurrency(g.target_amount)}
                </p>
              </li>
            )}
          />
          <ListCard
            title="Compras"
            testId="shopping"
            items={shopping}
            empty="Nenhuma compra para este mês."
            render={(s) => (
              <li key={s.id} className={rowClass}>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{s.name}</span>
                <span className={cn('rounded-full px-2 py-0.5 text-xs font-bold', s.checked ? 'bg-secondary text-secondary-foreground' : 'bg-primary/15 text-primary')}>
                  {s.checked ? 'Comprado' : 'Pendente'}
                </span>
              </li>
            )}
          />
        </>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        Investido no mês: <strong className="text-foreground">{formatCurrency(totals.total_invested)}</strong> · Saldo até hoje:{' '}
        <strong className="text-foreground">{formatCurrency(progress.balance)}</strong>
      </p>
    </div>
  );
}
