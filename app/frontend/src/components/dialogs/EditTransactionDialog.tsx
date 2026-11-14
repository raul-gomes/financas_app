import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Transaction } from '@/types/financial';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { TransactionFormFields } from '@/components/transactions/TransactionFormFields';
import { useTransactionForm } from '@/components/transactions/useTransactionForm';

interface EditTransactionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onEditTransaction: (transaction: Partial<Transaction>) => Promise<void>;
  transaction: Transaction;
}

const FORM_ID = 'edit-transaction-form';

/**
 * "Editar Transação" dialog (bottom sheet on mobile). It uses the same form as the create
 * dialog, starting from the transaction's values; this component owns validation and the
 * update payload.
 */
export function EditTransactionDialog({ isOpen, onClose, onEditTransaction, transaction }: EditTransactionDialogProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const form = useTransactionForm({ isOpen, transaction });
  const { values } = form;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const installments = parseInt(values.total_installments ?? '', 10);
    if (
      !values.amount ||
      !values.description ||
      !values.category_name ||
      !values.subcategory_name ||
      !values.payment_method ||
      !values.transaction_date ||
      (form.isInstallment && !(installments > 0))
    ) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    const payload: Partial<Transaction> = {
      ...transaction,
      type: values.type,
      amount: parseFloat(values.amount),
      description: values.description,
      category_name: values.category_name,
      subcategory_name: values.subcategory_name,
      transaction_date: values.transaction_date,
      payment_method: values.payment_method,
      entity_type: values.entity_type,
      bank_code: form.bankCode || null,
      is_installment: form.isInstallment,
      installment_number: form.isInstallment ? 1 : null,
      total_installments: form.isInstallment ? installments : null,
    };

    try {
      await onEditTransaction(payload);
      toast({ title: 'Sucesso', description: 'Transação editada!' });
      onClose();
    } catch {
      toast({ title: 'Erro', description: 'Falha ao editar transação.', variant: 'destructive' });
    }
  };

  return (
    <ResponsiveModal
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      title="Editar Transação"
      footer={
        isMobile ? (
          <Button type="submit" form={FORM_ID} className="h-12 w-full text-base font-bold">
            Salvar
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" form={FORM_ID}>
              Salvar
            </Button>
          </>
        )
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
        <TransactionFormFields form={form} />
      </form>
    </ResponsiveModal>
  );
}
