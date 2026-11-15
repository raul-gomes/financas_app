import { useState } from 'react';
import { Banknote, CreditCard, Receipt, Send, type LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { AnimatedNumber } from '@/components/AnimatedNumber';
import { BankBreakdownModal, type BankBreakdownItem } from '@/components/dialogs/BankBreakdownModal';
import { formatCurrency } from '@/lib/format';
import { bankItemsForMethod, installmentBankItems, methodTotal } from '@/lib/statementAggregates';
import type {
  StatementBankTotal,
  StatementInstallmentsDue,
  StatementPaymentMethodTotal,
} from '@/types/financial';

type KpiTheme = 'primary' | 'success' | 'destructive' | 'warning';

/** Delay between the entrance animations of consecutive cards. */
const CARD_ANIMATION_STEP_MS = 100;

/** Credit usage (percent of the limit) from which the bar turns to the warning color. */
const CREDIT_WARNING_RATIO = 0.8;

const THEME_STYLES: Record<KpiTheme, { card: string; icon: string }> = {
  primary: { card: 'bg-primary/10', icon: 'text-primary/70' },
  success: { card: 'bg-success/10', icon: 'text-success/70' },
  destructive: { card: 'bg-destructive/10', icon: 'text-destructive/70' },
  warning: { card: 'bg-warning/10', icon: 'text-warning/70' },
};

interface BreakdownState {
  title: string;
  total: number;
  items: BankBreakdownItem[];
  icon: LucideIcon;
  theme: KpiTheme;
}

interface PaymentKpiCardsProps {
  /** Expenses of the period per payment method (`expenses_by_payment_method`). */
  expensesByPaymentMethod: StatementPaymentMethodTotal[];
  /** Expenses of the period per payment method and bank (`expenses_by_bank`). */
  expensesByBank: StatementBankTotal[];
  /** Installments still to pay (`installments_due`). */
  installmentsDue: StatementInstallmentsDue;
  /** Credit card limit; 0 hides the usage bar. */
  creditCardLimit: number;
}

/**
 * The four payment KPI cards of the financial dashboard (Pix, credit, debit and
 * installments). On mobile they form a horizontal snap carousel; from `md` on, a
 * 4-column grid. Tapping a card opens the per-bank breakdown. Every number comes
 * from the statement's server-side aggregates (no transaction rows in the client).
 */
export function PaymentKpiCards({
  expensesByPaymentMethod,
  expensesByBank,
  installmentsDue,
  creditCardLimit,
}: PaymentKpiCardsProps) {
  const [breakdown, setBreakdown] = useState<BreakdownState | null>(null);

  const pixTotal = methodTotal(expensesByPaymentMethod, 'pix');
  const creditTotal = methodTotal(expensesByPaymentMethod, 'credit');
  const debitTotal = methodTotal(expensesByPaymentMethod, 'debit');
  const installmentsTotal = installmentsDue.remaining_amount;
  const installmentCount = installmentsDue.remaining_installments;
  const installmentTransactions = installmentsDue.transactions;

  const bankItems = (method: string): BankBreakdownItem[] => bankItemsForMethod(expensesByBank, method);
  const installmentItems = (): BankBreakdownItem[] => installmentBankItems(installmentsDue);

  const open = (state: Omit<BreakdownState, 'items'> & { items: BankBreakdownItem[] }) => {
    if (state.items.length > 0) setBreakdown(state);
  };

  const cardBase =
    'animate-slide-up h-full flex flex-col cursor-pointer max-md:w-40 max-md:shrink-0 max-md:snap-start';

  const renderCard = (
    index: number,
    props: {
      label: string;
      value: number;
      icon: LucideIcon;
      theme: KpiTheme;
      onOpen: () => void;
      footer?: React.ReactNode;
    },
  ) => {
    const Icon = props.icon;
    const styles = THEME_STYLES[props.theme];
    return (
      <div
        role="button"
        tabIndex={0}
        aria-label={props.label}
        className={cardBase}
        style={{ animationDelay: `${index * CARD_ANIMATION_STEP_MS}ms` }}
        onClick={props.onOpen}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            props.onOpen();
          }
        }}
      >
        <Card className={`shadow-card border-none ${styles.card} h-full hover:brightness-95 transition-all flex flex-col`}>
          <div className="p-4 flex flex-col h-full justify-between">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{props.label}</p>
                <p className="text-xl font-bold text-foreground">
                  <AnimatedNumber value={props.value} withDelay={100 + index * 150} />
                </p>
              </div>
              <Icon className={`h-6 w-6 ${styles.icon}`} />
            </div>
            {props.footer ?? <div className="h-4" />}
          </div>
        </Card>
      </div>
    );
  };

  const creditUsage = creditCardLimit > 0 ? creditTotal / creditCardLimit : 0;

  return (
    <>
      <div
        id="dashboard-ancora-metricas"
        className="scroll-mt-20 -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:px-0 md:pb-0 flex-shrink-0 [&::-webkit-scrollbar]:hidden"
      >
        {renderCard(0, {
          label: 'Pix',
          value: pixTotal,
          icon: Send,
          theme: 'primary',
          onOpen: () => open({ title: 'Pix', total: pixTotal, icon: Send, theme: 'primary', items: bankItems('pix') }),
        })}
        {renderCard(1, {
          label: 'Cartão de Crédito',
          value: creditTotal,
          icon: CreditCard,
          theme: 'success',
          onOpen: () =>
            open({ title: 'Cartão de Crédito', total: creditTotal, icon: CreditCard, theme: 'success', items: bankItems('credit') }),
          footer:
            creditCardLimit > 0 ? (
              <div className="mt-2">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span className="flex items-center gap-2">
                    {(creditUsage * 100).toFixed(0)}% usado
                    {creditUsage > 1 && (
                      <span className="rounded-full bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">
                        Estourando
                      </span>
                    )}
                  </span>
                  <span className="max-md:hidden">Limite: {formatCurrency(creditCardLimit)}</span>
                </div>
                <div className="w-full bg-white/30 rounded-full h-2 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      creditUsage > 1 ? 'bg-destructive' : creditUsage > CREDIT_WARNING_RATIO ? 'bg-warning' : 'bg-success'
                    }`}
                    style={{ width: `${Math.min(100, creditUsage * 100)}%` }}
                  />
                </div>
              </div>
            ) : undefined,
        })}
        {renderCard(2, {
          label: 'Cartão de Débito',
          value: debitTotal,
          icon: Banknote,
          theme: 'destructive',
          onOpen: () =>
            open({ title: 'Cartão de Débito', total: debitTotal, icon: Banknote, theme: 'destructive', items: bankItems('debit') }),
        })}
        {renderCard(3, {
          label: 'Parcelas a Pagar',
          value: installmentsTotal,
          icon: Receipt,
          theme: 'warning',
          onOpen: () =>
            open({ title: 'Parcelas a Pagar', total: installmentsTotal, icon: Receipt, theme: 'warning', items: installmentItems() }),
          footer:
            installmentCount > 0 ? (
              <p className="text-xs text-muted-foreground mt-1">
                {installmentCount} parcela{installmentCount !== 1 ? 's' : ''} · {installmentTransactions}{' '}
                {installmentTransactions === 1 ? 'transação' : 'transações'}
              </p>
            ) : undefined,
        })}
      </div>

      {breakdown && (
        <BankBreakdownModal
          open
          onClose={() => setBreakdown(null)}
          title={breakdown.title}
          total={breakdown.total}
          icon={breakdown.icon}
          theme={breakdown.theme}
          items={breakdown.items}
        />
      )}
    </>
  );
}
