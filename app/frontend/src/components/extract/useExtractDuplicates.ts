import { useCallback, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { invalidateTransactionData } from '@/hooks/queries/useTransactionQueries';
import { FinancialService } from '@/services/financialService';
import {
  flattenForDuplicateCheck,
  splitDuplicates,
  toDuplicateCheckPayload,
  type DuplicateItem,
} from '@/lib/extractReview';
import type { SessionData } from '@/types/extract';

/**
 * Duplicates between the uploaded rows and the transactions already saved. `checkSessions`
 * asks the backend and hands back the sessions without the duplicated rows, which stay in
 * `duplicateItems` until the user keeps the existing one or replaces it.
 */
export function useExtractDuplicates(onReplaced: (item: DuplicateItem) => void) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [duplicateItems, setDuplicateItems] = useState<DuplicateItem[]>([]);

  /**
   * Checks the sessions for duplicates. When the check fails the error is logged, the list
   * is cleared and the sessions come back untouched (every row stays reviewable).
   */
  const checkSessions = useCallback(
    async (sessions: SessionData[]): Promise<SessionData[]> => {
      try {
        const flat = flattenForDuplicateCheck(sessions);
        const check = await FinancialService.checkDuplicates(toDuplicateCheckPayload(flat));
        if (!check?.results) throw new Error('Resposta inválida do servidor');

        const { dupItems, cleanSessions } = splitDuplicates(sessions, flat, check.results);
        setDuplicateItems(dupItems);
        if (dupItems.length > 0) {
          const plural = dupItems.length > 1;
          toast({
            title: `${dupItems.length} duplicata${plural ? 's' : ''} encontrada${plural ? 's' : ''}`,
            description: 'Revise e resolva as duplicatas no topo da página antes de confirmar.',
          });
        }
        return cleanSessions;
      } catch (err) {
        console.error('Erro ao verificar duplicatas:', err);
        setDuplicateItems([]);
        return sessions;
      }
    },
    [toast],
  );

  /** Keeps the existing transaction: the uploaded row will not be imported. */
  const skipDuplicate = (key: string) => {
    setDuplicateItems((prev) => prev.map((d) => (d.key === key ? { ...d, resolved: 'skip' } : d)));
  };

  /** Deletes the existing transaction and puts the uploaded row back to be imported. */
  const replaceDuplicate = async (item: DuplicateItem) => {
    try {
      await FinancialService.deleteTransaction(item.existing.id);
      void invalidateTransactionData(queryClient);
      setDuplicateItems((prev) => prev.map((d) => (d.key === item.key ? { ...d, resolved: 'replace' } : d)));
      onReplaced(item);
      toast({ title: 'Substituído', description: 'Transação existente removida. A nova será importada.' });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao remover transação existente.', variant: 'destructive' });
    }
  };

  return { duplicateItems, checkSessions, skipDuplicate, replaceDuplicate };
}
