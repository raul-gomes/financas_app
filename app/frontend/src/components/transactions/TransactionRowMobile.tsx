import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { categoryLabel, paymentMethodLabel } from '@/lib/transactionLabels';
import { signedAmount } from '@/lib/transactionGroups';
import type { Transaction } from '@/types/financial';

/** Text and background tokens per transaction type. */
export const TYPE_TONE: Record<Transaction['type'], { text: string; avatar: string }> = {
  income: { text: 'text-success', avatar: 'bg-success/10 text-success' },
  expense: { text: 'text-destructive', avatar: 'bg-destructive/10 text-destructive' },
  investment: { text: 'text-warning', avatar: 'bg-warning/10 text-warning' },
};

interface TransactionRowMobileProps {
  transaction: Transaction;
  onOpen: (transaction: Transaction) => void;
}

/**
 * One transaction row of the mobile list: avatar, description (up to 2 lines),
 * "category · recurring/payment method" and the signed, colored amount. The whole
 * row is a button that opens the detail sheet (edit/delete live there).
 */
export function TransactionRowMobile({ transaction: t, onOpen }: TransactionRowMobileProps) {
  const tone = TYPE_TONE[t.type];
  const Icon = t.type === 'expense' ? ArrowDownRight : ArrowUpRight;
  const detail = t.recurring_account_id ? 'Recorrente' : paymentMethodLabel(t.payment_method);
  return (
    <button
      type="button"
      onClick={() => onOpen(t)}
      className="flex min-h-[56px] w-full items-center gap-3 border-t border-border py-2 text-left first:border-t-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-[10px]', tone.avatar)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 break-words text-sm font-semibold text-foreground">{t.description}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {categoryLabel(t.category_name)} · {detail}
        </span>
      </span>
      <span data-testid={`amount-${t.id}`} className={cn('shrink-0 whitespace-nowrap text-sm font-bold', tone.text)}>
        {signedAmount(t)}
      </span>
    </button>
  );
}
