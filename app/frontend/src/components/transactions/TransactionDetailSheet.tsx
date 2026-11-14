import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { TYPE_TONE } from '@/components/transactions/TransactionRowMobile';
import { useToast } from '@/hooks/use-toast';
import { formatDate } from '@/lib/format';
import { signedAmount } from '@/lib/transactionGroups';
import { categoryLabel, paymentMethodLabel, transactionTypeLabel } from '@/lib/transactionLabels';
import { cn } from '@/lib/utils';
import type { Transaction } from '@/types/financial';

interface TransactionDetailSheetProps {
  transaction: Transaction;
  /** Name of the transaction's bank, when known. */
  bankName: string | null;
  onClose: () => void;
  onEdit: (transaction: Transaction) => void;
  /** Deletes the transaction; rejects when the API fails. */
  onDelete: (id: number) => Promise<void>;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-border py-3 first:border-t-0">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Bottom sheet with the details of one transaction and its actions. Deleting asks
 * for confirmation first; editing hands the transaction to the caller.
 */
export function TransactionDetailSheet({ transaction: t, bankName, onClose, onEdit, onDelete }: TransactionDetailSheetProps) {
  const [confirming, setConfirming] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    try {
      await onDelete(t.id);
      onClose();
    } catch (error) {
      console.error('Error deleting transaction:', error);
      toast({ title: 'Erro', description: 'Falha ao excluir a transação.', variant: 'destructive' });
    }
  };

  const installments =
    t.total_installments && t.total_installments > 1 ? `${t.installment_number ?? 1}/${t.total_installments}` : null;

  return (
    <>
      <ResponsiveModal
        open
        onOpenChange={(open) => !open && onClose()}
        title={t.description}
        description="Detalhes do lançamento"
        size="sm"
        footer={
          <>
            <Button type="button" variant="outline" className="flex-1" onClick={() => onEdit(t)}>
              <Pencil aria-hidden="true" />
              Editar
            </Button>
            <Button type="button" variant="destructive" className="flex-1" onClick={() => setConfirming(true)}>
              <Trash2 aria-hidden="true" />
              Excluir
            </Button>
          </>
        }
      >
        <p className={cn('mb-2 text-3xl font-extrabold tracking-tight', TYPE_TONE[t.type].text)}>{signedAmount(t)}</p>
        <dl>
          <Detail label="Data">{formatDate(t.transaction_date)}</Detail>
          <Detail label="Tipo">{transactionTypeLabel(t.type)}</Detail>
          <Detail label="Categoria">
            {categoryLabel(t.category_name)}
            {t.subcategory_name ? ` · ${t.subcategory_name}` : ''}
          </Detail>
          <Detail label="Pagamento">{paymentMethodLabel(t.payment_method)}</Detail>
          {installments && <Detail label="Parcela">{installments}</Detail>}
          {bankName && <Detail label="Banco">{bankName}</Detail>}
          <Detail label="Conta">{t.entity_type === 'business' ? 'PJ' : 'PF'}</Detail>
          {t.recurring_account_id && <Detail label="Origem">Conta recorrente</Detail>}
        </dl>
      </ResponsiveModal>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Excluir esta transação?"
        description="Esta ação não pode ser desfeita."
        destructive
        confirmLabel="Excluir"
        onConfirm={() => void handleDelete()}
      />
    </>
  );
}
