import { useIsMobile } from '@/hooks/use-mobile';
import { TransactionFieldsDesktop } from './TransactionFieldsDesktop';
import { TransactionFieldsMobile } from './TransactionFieldsMobile';
import type { TransactionForm } from './useTransactionForm';

interface TransactionFormFieldsProps {
  form: TransactionForm;
}

/** The transaction form body: the bottom-sheet layout below `md`, the dialog layout from `md` on. */
export function TransactionFormFields({ form }: TransactionFormFieldsProps) {
  const isMobile = useIsMobile();
  return isMobile ? <TransactionFieldsMobile form={form} /> : <TransactionFieldsDesktop form={form} />;
}
