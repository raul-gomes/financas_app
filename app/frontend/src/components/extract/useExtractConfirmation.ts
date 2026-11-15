import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { invalidateTransactionData } from '@/hooks/queries/useTransactionQueries';
import { ExtractoService } from '@/services/extractService';
import { buildConfirmTransactions, validateSession, type RowDrafts } from '@/lib/extractReview';
import type { SessionData } from '@/types/extract';
import type { CategorySubcategories } from '@/types/financial';

/** Wait before leaving the page after everything was imported (lets the user read the toast). */
export const REDIRECT_DELAY_MS = 800;

interface UseExtractConfirmationParams {
  sessions: SessionData[];
  drafts: RowDrafts;
  categoryOptions: CategorySubcategories | null;
  updateSession: (sIdx: number, updates: Partial<SessionData>) => void;
  /** Called once every session has been imported. */
  onAllImported: () => void;
}

/**
 * Confirmation step: validates the sessions and imports them one at a time. Each import
 * refreshes the transaction data (list, dashboards, overview, limits, goals).
 */
export function useExtractConfirmation({
  sessions,
  drafts,
  categoryOptions,
  updateSession,
  onAllImported,
}: UseExtractConfirmationParams) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isConfirming, setIsConfirming] = useState(false);

  const payloadOf = (sIdx: number) => ({
    transactions: buildConfirmTransactions(sessions[sIdx], sIdx, drafts),
  });

  /** Confirms one already-validated session. */
  const importSession = async (sIdx: number) => {
    const session = sessions[sIdx];
    setIsConfirming(true);
    try {
      const result = await ExtractoService.confirm(payloadOf(sIdx));
      void invalidateTransactionData(queryClient);
      updateSession(sIdx, { isConfirmed: true });
      toast({
        title: 'Sucesso',
        description: `${result.created} transações importadas de "${session.filename}"!`,
      });

      const allDone = sessions.every((s, i) => (i === sIdx ? true : s.isConfirmed));
      if (allDone) {
        toast({ title: 'Concluído', description: 'Todas as transações foram importadas!' });
        setTimeout(onAllImported, REDIRECT_DELAY_MS);
      }
    } catch {
      toast({
        title: 'Erro',
        description: `Falha ao confirmar sessão "${session.filename}".`,
        variant: 'destructive',
      });
    } finally {
      setIsConfirming(false);
    }
  };

  const confirmSession = async (sIdx: number) => {
    const validation = validateSession(sessions[sIdx], sIdx, drafts, categoryOptions);
    if (validation.hasErrors) {
      toast({
        title: 'Validação',
        description: `Corrija os ${validation.errorCount} erro(s) antes de confirmar.`,
        variant: 'destructive',
      });
      return;
    }
    // Duplicates were already checked at upload time: confirm directly
    await importSession(sIdx);
  };

  const confirmAll = async () => {
    let totalErrors = 0;
    sessions.forEach((s, i) => {
      if (!s.isConfirmed) totalErrors += validateSession(s, i, drafts, categoryOptions).errorCount;
    });
    if (totalErrors > 0) {
      toast({
        title: 'Validação',
        description: `Corrija os ${totalErrors} erro(s) antes de confirmar tudo.`,
        variant: 'destructive',
      });
      return;
    }

    setIsConfirming(true);
    let allOk = true;
    for (let i = 0; i < sessions.length; i++) {
      if (sessions[i].isConfirmed) continue;
      try {
        await ExtractoService.confirm(payloadOf(i));
        void invalidateTransactionData(queryClient);
        updateSession(i, { isConfirmed: true });
      } catch {
        toast({
          title: 'Erro',
          description: `Falha ao confirmar "${sessions[i].filename}". As anteriores foram salvas.`,
          variant: 'destructive',
        });
        allOk = false;
        break;
      }
    }
    setIsConfirming(false);

    if (allOk) {
      toast({ title: 'Sucesso', description: 'Todas as sessões foram importadas!' });
      setTimeout(onAllImported, REDIRECT_DELAY_MS);
    }
  };

  return { isConfirming, confirmSession, confirmAll };
}
