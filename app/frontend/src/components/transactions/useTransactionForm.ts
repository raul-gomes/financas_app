import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useBanks } from '@/hooks/queries/useSettingsQueries';
import { useToast } from '@/hooks/use-toast';
import { FinancialService } from '@/services/financialService';
import type { UserBank } from '@/services/settingsService';
import { NotificationService } from '@/services/notificationService';
import { queryKeys } from '@/lib/queryKeys';
import type { CategoryRiskResponse } from '@/types/notifications';
import type { CategorySubcategories, Transaction } from '@/types/financial';
import {
  AUTO_CATEGORY_BY_TYPE,
  brToIso,
  emptyFormValues,
  installmentValue,
  isKnownPaymentMethod,
  isoToBr,
  maskDateBR,
  valuesFromTransaction,
  type TransactionFormValues,
} from './transactionFormModel';

/** A select that can switch to a free-text "Outro/Outra" option. */
function useCustomChoice() {
  const [active, setActive] = useState(false);
  const [text, setText] = useState('');
  return {
    active,
    text,
    setText,
    activate: () => setActive(true),
    deactivate: () => {
      setActive(false);
      setText('');
    },
    set: (isActive: boolean, value: string) => {
      setActive(isActive);
      setText(value);
    },
  };
}

interface UseTransactionFormOptions {
  /** Whether the dialog is open (categories of an edited transaction load on open). */
  isOpen: boolean;
  /** Transaction being edited; omit to create a new one. */
  transaction?: Transaction;
  /** Project the category limit while typing (create only). */
  checkRisk?: boolean;
}

/**
 * State and data loading of the transaction form, shared by the create and edit
 * dialogs: values, typed date, installments, bank, category options (by scope and
 * type), "Outro" choices and the non-blocking limit risk.
 */
export function useTransactionForm({ isOpen, transaction, checkRisk = false }: UseTransactionFormOptions) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const initialValues = useCallback(
    () => (transaction ? valuesFromTransaction(transaction) : emptyFormValues(new Date())),
    [transaction],
  );

  const [values, setValuesState] = useState<TransactionFormValues>(initialValues);
  const [dateInput, setDateInput] = useState(() => isoToBr(initialValues().transaction_date));
  const [isInstallment, setIsInstallment] = useState(!!transaction?.total_installments && transaction.total_installments > 1);
  const [bankCode, setBankCode] = useState(transaction?.bank_code ?? '');
  const [addingNewBank, setAddingNewBank] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories | null>(null);
  const [categoryRisk, setCategoryRisk] = useState<CategoryRiskResponse | null>(null);
  const newCategory = useCustomChoice();
  const newSubcategory = useCustomChoice();
  const newPaymentMethod = useCustomChoice();

  const { data: banks = [] } = useBanks();

  const setValues = (patch: Partial<TransactionFormValues>) => setValuesState((prev) => ({ ...prev, ...patch }));

  /** Changing the type: income and investments use a fixed automatic category. */
  const setType = (type: Transaction['type']) => {
    if (type === 'income' || type === 'investment') {
      setValues({ type, category_name: AUTO_CATEGORY_BY_TYPE[type], subcategory_name: '' });
    } else {
      setValues({ type });
    }
  };

  const onDateInputChange = (raw: string) => {
    const masked = maskDateBR(raw);
    setDateInput(masked);
    setValues({ transaction_date: brToIso(masked) });
  };

  /** Back to a blank (or the original, when editing) form. */
  const reset = useCallback(() => {
    const initial = initialValues();
    setValuesState(initial);
    setDateInput(isoToBr(initial.transaction_date));
    setIsInstallment(!!transaction?.total_installments && transaction.total_installments > 1);
    setBankCode(transaction?.bank_code ?? '');
    setAddingNewBank(false);
    setCategoryRisk(null);
    newCategory.set(false, '');
    newSubcategory.set(false, '');
    const custom = !!transaction?.payment_method && !isKnownPaymentMethod(transaction.payment_method);
    newPaymentMethod.set(custom, custom ? (transaction?.payment_method ?? '') : '');
    // the custom-choice setters are stable enough for a reset on open/prop change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialValues, transaction]);

  // Editing: re-sync the form when the dialog opens or another transaction arrives
  useEffect(() => {
    if (transaction) reset();
  }, [isOpen, transaction, reset]);

  // Category options follow the scope (PF/PJ) and the type
  const decidedCustomFor = useRef<number | null>(null);
  useEffect(() => {
    if (transaction && !isOpen) return;
    let cancelled = false;
    FinancialService.getCategorySubcategories(values.entity_type, values.type)
      .then((options) => {
        if (cancelled) return;
        setCategoryOptions(options);
        // Editing: a category/subcategory missing from the options is shown as "Outra" with its name
        if (transaction && decidedCustomFor.current !== transaction.id) {
          decidedCustomFor.current = transaction.id;
          const categoryName = transaction.category_name ?? '';
          const subcategoryName = transaction.subcategory_name ?? '';
          const existsCategory = options.options.some((c) => c.name === categoryName);
          newCategory.set(!existsCategory, existsCategory ? '' : categoryName);
          const subs = options.options.find((c) => c.name === categoryName)?.subcategories.map((s) => s.name) ?? [];
          const existsSub = subs.includes(subcategoryName);
          newSubcategory.set(!existsSub, existsSub ? '' : subcategoryName);
        }
      })
      .catch((error: unknown) => {
        console.error('Error loading categories:', error);
        toast({ title: 'Erro', description: 'Falha ao carregar categorias.', variant: 'destructive' });
      });
    return () => {
      cancelled = true;
    };
    // newCategory/newSubcategory/toast are stable setters; only the filters should reload the options
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values.entity_type, values.type, transaction, isOpen]);

  // Non-blocking warning: projected limit use (spent so far + typed amount)
  useEffect(() => {
    if (!checkRisk || values.type !== 'expense') {
      setCategoryRisk(null);
      return;
    }
    const category = categoryOptions?.options.find((c) => c.name === values.category_name);
    if (!category) {
      setCategoryRisk(null);
      return;
    }
    let cancelled = false;
    NotificationService.checkCategoryRisk(category.id, parseFloat(values.amount) || 0)
      .then((risk) => {
        if (!cancelled) setCategoryRisk(risk);
      })
      .catch((error: unknown) => {
        // The limit warning is a bonus and never blocks the flow: the error is only logged.
        console.error('Category risk check failed:', error);
      });
    return () => {
      cancelled = true;
    };
  }, [checkRisk, values.category_name, values.entity_type, values.type, values.amount, categoryOptions]);

  /** A bank created inside the form joins the cached list and gets selected. */
  const onBankAdded = (bank: UserBank) => {
    queryClient.setQueryData<UserBank[]>(queryKeys.settings.banks(), (prev) => [...(prev ?? []), bank]);
    setBankCode(bank.bank_code);
    setAddingNewBank(false);
  };

  return {
    values,
    setValues,
    setType,
    dateInput,
    onDateInputChange,
    isInstallment,
    setIsInstallment,
    bankCode,
    setBankCode,
    banks,
    addingNewBank,
    setAddingNewBank,
    onBankAdded,
    categoryOptions,
    categoryRisk,
    newCategory,
    newSubcategory,
    newPaymentMethod,
    installmentAmount: installmentValue(isInstallment, values.amount, values.total_installments),
    reset,
  };
}

export type TransactionForm = ReturnType<typeof useTransactionForm>;
