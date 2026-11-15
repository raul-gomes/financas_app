import { useCallback, useState } from 'react';
import {
  EMPTY_ROW_DRAFT,
  changeCategory,
  changePaymentMethod,
  changeSubcategory,
  parseTotalInstallments,
  toggleInstallment,
  typeCategoryName,
  typePaymentMethodName,
  typeSubcategoryName,
  type RowChange,
  type RowDrafts,
} from '@/lib/extractReview';
import type { ParsedTransaction, SessionData } from '@/types/extract';
import type { CategorySubcategories } from '@/types/financial';

/** Every edit the user can make on one review row (already bound to its session and row). */
export interface RowActions {
  onDescriptionChange: (value: string) => void;
  onPaymentMethodChange: (value: string) => void;
  onPaymentMethodNameChange: (value: string) => void;
  onEntityTypeChange: (entityType: string) => void;
  onCategoryChange: (value: string) => void;
  onCategoryNameChange: (value: string) => void;
  onSubcategoryChange: (value: string) => void;
  onSubcategoryNameChange: (value: string) => void;
  onInstallmentToggle: (checked: boolean) => void;
  onTotalInstallmentsChange: (raw: string) => void;
  onRemove: () => void;
}

/**
 * State of the review: the sessions being imported and the per-row drafts (free-text
 * choices and installments), plus the edits on them. Pure rules live in `lib/extractReview`.
 */
export function useExtractReview(initialSessions: SessionData[], categoryOptions: CategorySubcategories | null) {
  const [sessions, setSessions] = useState<SessionData[]>(initialSessions);
  const [drafts, setDrafts] = useState<RowDrafts>({});

  const updateSession = useCallback((sIdx: number, updates: Partial<SessionData>) => {
    setSessions((prev) => prev.map((s, i) => (i === sIdx ? { ...s, ...updates } : s)));
  }, []);

  const updateTransaction = useCallback((sIdx: number, rIdx: number, updates: Partial<ParsedTransaction>) => {
    setSessions((prev) =>
      prev.map((s, i) =>
        i === sIdx
          ? { ...s, transactions: s.transactions.map((t, j) => (j === rIdx ? { ...t, ...updates } : t)) }
          : s,
      ),
    );
  }, []);

  const removeTransaction = useCallback((sIdx: number, rIdx: number) => {
    setSessions((prev) =>
      prev.map((s, i) => (i === sIdx ? { ...s, transactions: s.transactions.filter((_, j) => j !== rIdx) } : s)),
    );
  }, []);

  /** Puts a transaction back at the end of its session (a duplicate that was replaced). */
  const appendTransaction = useCallback((sIdx: number, transaction: ParsedTransaction) => {
    setSessions((prev) =>
      prev.map((s, i) => (i === sIdx ? { ...s, transactions: [...s.transactions, transaction] } : s)),
    );
  }, []);

  const patchDraft = useCallback((key: string, patch: Partial<RowDrafts[string]>) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...(prev[key] ?? EMPTY_ROW_DRAFT), ...patch } }));
  }, []);

  /** The edits of one row, bound to its coordinates (drafts are kept by the row's stable id). */
  const rowActions = (sIdx: number, rIdx: number): RowActions => {
    const key = sessions[sIdx].transactions[rIdx].rowId;
    const applyChange = (change: RowChange) => {
      patchDraft(key, change.draft);
      updateTransaction(sIdx, rIdx, change.transaction);
    };
    return {
      onDescriptionChange: (value) => updateTransaction(sIdx, rIdx, { description: value }),
      onPaymentMethodChange: (value) => applyChange(changePaymentMethod(value)),
      onPaymentMethodNameChange: (value) => applyChange(typePaymentMethodName(value)),
      onEntityTypeChange: (entityType) => updateTransaction(sIdx, rIdx, { entity_type: entityType }),
      onCategoryChange: (value) => applyChange(changeCategory(value, categoryOptions)),
      onCategoryNameChange: (value) => applyChange(typeCategoryName(value)),
      onSubcategoryChange: (value) => applyChange(changeSubcategory(value)),
      onSubcategoryNameChange: (value) => applyChange(typeSubcategoryName(value)),
      onInstallmentToggle: (checked) =>
        patchDraft(key, toggleInstallment(drafts[key] ?? EMPTY_ROW_DRAFT, checked)),
      onTotalInstallmentsChange: (raw) => patchDraft(key, { totalInstallments: parseTotalInstallments(raw) }),
      onRemove: () => removeTransaction(sIdx, rIdx),
    };
  };

  return {
    sessions,
    setSessions,
    drafts,
    updateSession,
    appendTransaction,
    rowActions,
  };
}
