import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { EMPTY_ROW_DRAFT, type RowDrafts } from '@/lib/extractReview';
import type { ParsedTransaction } from '@/types/extract';
import type { CategorySubcategories } from '@/types/financial';
import {
  CategoryField,
  EntityTypeField,
  InstallmentsField,
  PaymentMethodField,
  SubcategoryField,
} from './ExtractRowFields';
import { ExtractTypeBadge } from './ExtractTypeBadge';
import type { RowActions } from './useExtractReview';

interface ExtractTransactionCardsProps {
  transactions: ParsedTransaction[];
  drafts: RowDrafts;
  categoryOptions: CategorySubcategories | null;
  /** Edits of the row `rIdx` of this session. */
  rowActions: (rIdx: number) => RowActions;
}

/**
 * Phone layout (below `md`) of the rows of one session: one card per row with the same
 * fields as the table, stacked, with 44px controls and no horizontal scroll.
 */
export function ExtractTransactionCards({
  transactions,
  drafts,
  categoryOptions,
  rowActions,
}: ExtractTransactionCardsProps) {
  return (
    <ul className="divide-y divide-border">
      {transactions.map((transaction, rIdx) => (
        <ExtractTransactionCard
          key={transaction.rowId}
          transaction={transaction}
          draft={drafts[transaction.rowId] ?? EMPTY_ROW_DRAFT}
          categoryOptions={categoryOptions}
          actions={rowActions(rIdx)}
        />
      ))}
    </ul>
  );
}

interface ExtractTransactionCardProps {
  transaction: ParsedTransaction;
  draft: RowDrafts[string];
  categoryOptions: CategorySubcategories | null;
  actions: RowActions;
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function ExtractTransactionCard({ transaction, draft, categoryOptions, actions }: ExtractTransactionCardProps) {
  const isIncome = transaction.type === 'income';
  return (
    <li data-testid="extract-row-card" className="space-y-3 px-4 py-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="text-xs whitespace-nowrap">{transaction.date}</span>
          <ExtractTypeBadge type={transaction.type} />
          <span className={`text-sm font-semibold whitespace-nowrap ${isIncome ? 'text-success' : 'text-destructive'}`}>
            {transaction.type === 'expense' ? '-' : ''}
            {formatCurrency(transaction.amount)}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-11 w-11 shrink-0 p-0 text-muted-foreground hover:text-destructive"
          onClick={actions.onRemove}
          title="Remover transação"
          aria-label="Remover transação"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <input
        type="text"
        value={transaction.description}
        onChange={(e) => actions.onDescriptionChange(e.target.value)}
        aria-label="Descrição"
        className="h-11 w-full rounded border border-border bg-transparent px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
      />

      <Labeled label="Pagamento">
        <PaymentMethodField transaction={transaction} draft={draft} actions={actions} size="touch" />
      </Labeled>
      <Labeled label="Categoria">
        <CategoryField
          transaction={transaction}
          draft={draft}
          actions={actions}
          categoryOptions={categoryOptions}
          size="touch"
        />
      </Labeled>
      <Labeled label="Subcategoria">
        <SubcategoryField
          transaction={transaction}
          draft={draft}
          actions={actions}
          categoryOptions={categoryOptions}
          size="touch"
        />
      </Labeled>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Labeled label="Parcelado">
          <InstallmentsField draft={draft} actions={actions} size="touch" />
        </Labeled>
        <Labeled label="Natureza">
          <EntityTypeField transaction={transaction} actions={actions} size="touch" />
        </Labeled>
      </div>
    </li>
  );
}
