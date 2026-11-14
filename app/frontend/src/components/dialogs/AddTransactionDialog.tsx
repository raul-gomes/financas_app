import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Transaction, DuplicateInfo, TransactionCreatePayload } from '@/types/financial';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { FinancialService } from '@/services/financialService';
import { DuplicateDialog, DialogAction } from '@/components/dialogs/DuplicateDialog';
import { TransactionFormFields } from '@/components/transactions/TransactionFormFields';
import { useTransactionForm } from '@/components/transactions/useTransactionForm';

interface AddTransactionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (transaction: Transaction) => void;
}

const FORM_ID = 'add-transaction-form';

/**
 * "Nova Transação" dialog (bottom sheet on mobile). The fields come from the shared
 * transaction form; this component owns the create flow: validation, duplicate check,
 * the API call and the limit-risk warning.
 */
export function AddTransactionDialog({ isOpen, onClose, onAddTransaction }: AddTransactionDialogProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const form = useTransactionForm({ isOpen, checkRisk: true });
  const { values } = form;

  // Duplicate checking state
  const [duplicateConflict, setDuplicateConflict] = useState<{
    existing: DuplicateInfo;
    payload: TransactionCreatePayload;
    newData: { description: string; amount: number; transaction_date: string };
  } | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  // Reset form on close
  const handleClose = () => {
    form.reset();
    onClose();
  };

  const buildPayload = (): TransactionCreatePayload => {
    const category = form.categoryOptions?.options.find((c) => c.name === values.category_name);
    const subcategory = category?.subcategories.find((s) => s.name === values.subcategory_name);

    const payload: TransactionCreatePayload = {
      type: values.type,
      amount: parseFloat(values.amount),
      description: values.description,
      transaction_date: values.transaction_date,
      payment_method: values.payment_method,
      entity_type: values.entity_type,
    };

    if (form.bankCode) payload.bank_code = form.bankCode;
    payload.is_installment = form.isInstallment;
    if (form.isInstallment) {
      payload.installment_number = 1;
      payload.total_installments = parseInt(values.total_installments ?? '1', 10);
    }
    if (category && subcategory) {
      payload.category_id = category.id;
      payload.subcategory_id = subcategory.id;
    } else {
      payload.category_name = values.category_name;
      payload.subcategory_name = values.subcategory_name;
    }
    return payload;
  };

  const executeAdd = async (payload: TransactionCreatePayload) => {
    try {
      await FinancialService.addTransaction(payload);
      toast({ title: 'Transação adicionada', description: 'Sucesso!' });
      handleClose();
      onAddTransaction(payload as unknown as Transaction);
    } catch {
      toast({ title: 'Erro', description: 'Falha ao criar transação.', variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!values.amount || !values.description || !values.category_name || !values.subcategory_name) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios.', variant: 'destructive' });
      return;
    }

    if (!values.transaction_date) {
      toast({ title: 'Erro', description: 'Informe uma data válida.', variant: 'destructive' });
      return;
    }

    const payload = buildPayload();

    // Check for duplicates before creating
    setIsCheckingDuplicate(true);
    try {
      const checkResult = await FinancialService.checkDuplicates({
        transaction_date: values.transaction_date,
        amount: parseFloat(values.amount),
      });

      if (checkResult.results[0]?.has_duplicate) {
        setDuplicateConflict({
          existing: checkResult.results[0].duplicates[0],
          payload,
          newData: {
            description: values.description,
            amount: parseFloat(values.amount),
            transaction_date: values.transaction_date,
          },
        });
        return;
      }
    } catch (error) {
      // The duplicate check is advisory: warn the user and still let them save.
      console.error('Duplicate check failed; adding the transaction anyway:', error);
      toast({
        title: 'Aviso',
        description: 'Não foi possível verificar duplicidade. A transação será salva mesmo assim.',
      });
    } finally {
      setIsCheckingDuplicate(false);
    }

    await executeAdd(payload);
  };

  const handleDuplicateAction = async (action: DialogAction) => {
    if (!duplicateConflict) return;

    if (action === 'keep') {
      // Skip — do nothing
      setDuplicateConflict(null);
      handleClose();
    } else if (action === 'replace') {
      // Delete existing, then add new
      try {
        await FinancialService.deleteTransaction(duplicateConflict.existing.id);
        await executeAdd(duplicateConflict.payload);
      } catch {
        toast({ title: 'Erro', description: 'Falha ao substituir transação.', variant: 'destructive' });
      }
      setDuplicateConflict(null);
    } else if (action === 'edit') {
      // Close duplicate dialog, keep form open so user can edit
      setDuplicateConflict(null);
    }
  };

  return (
    <>
      <ResponsiveModal
        open={isOpen}
        onOpenChange={(open) => !open && handleClose()}
        title="Nova Transação"
        footer={
          isMobile ? (
            <Button type="submit" form={FORM_ID} className="h-12 w-full text-base font-bold" disabled={isCheckingDuplicate}>
              {isCheckingDuplicate ? 'Verificando...' : 'Salvar'}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
                Cancelar
              </Button>
              <Button type="submit" form={FORM_ID} className="flex-1 bg-gradient-primary" disabled={isCheckingDuplicate}>
                {isCheckingDuplicate ? 'Verificando...' : 'Adicionar'}
              </Button>
            </>
          )
        }
      >
        <form id={FORM_ID} onSubmit={handleSubmit} className="space-y-4">
          <TransactionFormFields form={form} />
        </form>
      </ResponsiveModal>

      {/* Duplicate Dialog */}
      {duplicateConflict && (
        <DuplicateDialog
          open={!!duplicateConflict}
          conflicts={[
            {
              index: 0,
              existing: duplicateConflict.existing,
              newData: duplicateConflict.newData,
            },
          ]}
          onResolve={(action) => handleDuplicateAction(action)}
          onClose={() => setDuplicateConflict(null)}
        />
      )}
    </>
  );
}
