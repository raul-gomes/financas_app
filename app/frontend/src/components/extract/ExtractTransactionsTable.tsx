import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import { EMPTY_ROW_DRAFT, rowKey, type RowDrafts } from '@/lib/extractReview';
import type { ParsedTransaction } from '@/types/extract';
import type { CategorySubcategories } from '@/types/financial';
import {
  CategoryCell,
  EntityTypeCell,
  InstallmentsCell,
  PaymentMethodCell,
  SubcategoryCell,
} from './ExtractRowCells';
import { ExtractTypeBadge } from './ExtractTypeBadge';
import type { RowActions } from './useExtractReview';

/** Column headers of the review table (the last, empty one holds the remove button). */
const COLUMNS = ['Data', 'Descrição', 'Valor', 'Tipo', 'Parcelas', 'Pagto', 'Nat.', 'Categoria', 'Subcategoria'];

interface ExtractTransactionsTableProps {
  sIdx: number;
  transactions: ParsedTransaction[];
  drafts: RowDrafts;
  categoryOptions: CategorySubcategories | null;
  /** Edits of the row `rIdx` of this session. */
  rowActions: (rIdx: number) => RowActions;
}

/**
 * Editable rows of one session. The table scrolls inside its own container, so the page
 * never grows wider than the screen on a phone.
 */
export function ExtractTransactionsTable({
  sIdx,
  transactions,
  drafts,
  categoryOptions,
  rowActions,
}: ExtractTransactionsTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b border-border">
          <tr>
            {COLUMNS.map((label) => (
              <th key={label} className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                {label}
              </th>
            ))}
            <th className="px-3 py-2 w-10"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {transactions.map((transaction, rIdx) => {
            const id = rowKey(sIdx, rIdx);
            return (
              <ExtractTransactionRow
                key={rIdx}
                rowId={id}
                transaction={transaction}
                draft={drafts[id] ?? EMPTY_ROW_DRAFT}
                categoryOptions={categoryOptions}
                actions={rowActions(rIdx)}
              />
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

interface ExtractTransactionRowProps {
  rowId: string;
  transaction: ParsedTransaction;
  draft: RowDrafts[string];
  categoryOptions: CategorySubcategories | null;
  actions: RowActions;
}

function ExtractTransactionRow({ rowId, transaction, draft, categoryOptions, actions }: ExtractTransactionRowProps) {
  return (
    <tr className="hover:bg-muted/30">
      <td className="px-3 py-2 text-xs whitespace-nowrap">{transaction.date}</td>
      <td className="px-3 py-2 min-w-[140px]">
        <input
          type="text"
          value={transaction.description}
          onChange={(e) => actions.onDescriptionChange(e.target.value)}
          className="w-full text-xs bg-transparent border border-border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </td>
      <td
        className={`px-3 py-2 text-xs font-medium whitespace-nowrap ${
          transaction.type === 'income' ? 'text-success' : 'text-destructive'
        }`}
      >
        {transaction.type === 'expense' ? '-' : ''}
        {formatCurrency(transaction.amount)}
      </td>
      <td className="px-3 py-2">
        <ExtractTypeBadge type={transaction.type} />
      </td>
      <InstallmentsCell rowId={rowId} draft={draft} actions={actions} />
      <PaymentMethodCell transaction={transaction} draft={draft} actions={actions} />
      <EntityTypeCell transaction={transaction} actions={actions} />
      <CategoryCell transaction={transaction} draft={draft} actions={actions} categoryOptions={categoryOptions} />
      <SubcategoryCell transaction={transaction} draft={draft} actions={actions} categoryOptions={categoryOptions} />
      <td className="px-1 py-2">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
          onClick={actions.onRemove}
          title="Remover transação"
          aria-label="Remover transação"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </tr>
  );
}
