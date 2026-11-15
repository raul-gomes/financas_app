import { AlertCircle } from 'lucide-react';
import type { RowDrafts } from '@/lib/extractReview';
import type { UserBank } from '@/services/settingsService';
import type { SessionData } from '@/types/extract';
import type { CategorySubcategories } from '@/types/financial';
import { ExtractAddBankForm } from './ExtractAddBankForm';
import { ExtractSessionHeader } from './ExtractSessionHeader';
import { ExtractTransactionsTable } from './ExtractTransactionsTable';
import type { RowActions } from './useExtractReview';

interface ExtractSessionCardProps {
  session: SessionData;
  sIdx: number;
  banks: UserBank[];
  categoryOptions: CategorySubcategories | null;
  drafts: RowDrafts;
  isConfirming: boolean;
  /** True while the inline "add bank" form is open for this session. */
  isAddingBank: boolean;
  rowActions: (rIdx: number) => RowActions;
  onBankSelect: (value: string) => void;
  onAddBank: (bankCode: string, bankName: string) => void;
  onCancelAddBank: () => void;
  onConfirm: () => void;
}

/** One uploaded file: header (bank + confirm), optional add-bank form, rows and warnings. */
export function ExtractSessionCard({
  session,
  sIdx,
  banks,
  categoryOptions,
  drafts,
  isConfirming,
  isAddingBank,
  rowActions,
  onBankSelect,
  onAddBank,
  onCancelAddBank,
  onConfirm,
}: ExtractSessionCardProps) {
  const isPending = !session.isConfirmed;
  const withoutCategory = session.transactions.filter((t) => !t.category_id).length;

  return (
    <div
      className={`rounded-lg border-2 overflow-hidden transition-colors ${
        session.isConfirmed ? 'border-success opacity-80' : 'border-warning'
      }`}
    >
      <ExtractSessionHeader
        session={session}
        banks={banks}
        isConfirming={isConfirming}
        onBankSelect={onBankSelect}
        onConfirm={onConfirm}
      />

      {isAddingBank && <ExtractAddBankForm onSubmit={onAddBank} onCancel={onCancelAddBank} />}

      {!session.isConfirmed && (
        <ExtractTransactionsTable
          sIdx={sIdx}
          transactions={session.transactions}
          drafts={drafts}
          categoryOptions={categoryOptions}
          rowActions={rowActions}
        />
      )}

      {isPending && withoutCategory > 0 && (
        <div className="px-4 py-2 flex items-center gap-2 text-warning bg-warning/5 border-t border-border">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span className="text-xs">{withoutCategory} transação(ões) sem categoria</span>
        </div>
      )}
    </div>
  );
}
