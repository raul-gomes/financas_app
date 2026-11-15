import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { useToast } from '@/hooks/use-toast';
import { useErrorToast } from '@/hooks/queries/useErrorToast';
import { useCategoryOptions } from '@/hooks/queries/useFinancialQueries';
import { useAddBank, useBanks } from '@/hooks/queries/useSettingsQueries';
import { ADD_BANK_OPTION, summarizeSessions } from '@/lib/extractReview';
import { ExtractConfirmBar } from '@/components/extract/ExtractConfirmBar';
import { ExtractDuplicatesSection } from '@/components/extract/ExtractDuplicatesSection';
import { ExtractReviewHeader } from '@/components/extract/ExtractReviewHeader';
import { ExtractSessionCard } from '@/components/extract/ExtractSessionCard';
import { ExtractSummaryCards } from '@/components/extract/ExtractSummaryCards';
import { ExtractUploadStep } from '@/components/extract/ExtractUploadStep';
import { useExtractConfirmation } from '@/components/extract/useExtractConfirmation';
import { useExtractDuplicates } from '@/components/extract/useExtractDuplicates';
import { useExtractReview } from '@/components/extract/useExtractReview';
import { useExtractUpload } from '@/components/extract/useExtractUpload';
import type { SessionData } from '@/types/extract';

/** Where to go after the import (or when the user gives up). */
const AFTER_IMPORT_ROUTE = '/financial';

/**
 * Bank statement import (`/extrato-bancario`): upload CSV/OFX files, review and fix the
 * parsed rows (category, payment method, installments, bank), resolve duplicates and
 * confirm. Categories and banks come from the shared query cache.
 */
const BankExtract = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const initialSessions = (location.state as { sessions?: SessionData[] } | null)?.sessions || [];

  const { data: categoryOptions = null, isError: categoriesFailed } = useCategoryOptions('all');
  const { data: banks = [], isError: banksFailed } = useBanks();
  useErrorToast(categoriesFailed, 'Falha ao carregar as categorias.');
  useErrorToast(banksFailed, 'Falha ao carregar os bancos.');
  const addBank = useAddBank();

  const { sessions, setSessions, drafts, updateSession, appendTransaction, rowActions } = useExtractReview(
    initialSessions,
    categoryOptions,
  );
  const { duplicateItems, checkSessions, skipDuplicate, replaceDuplicate } = useExtractDuplicates((item) =>
    appendTransaction(item.sIdx, item.transaction),
  );
  const upload = useExtractUpload(checkSessions, setSessions);
  const confirmation = useExtractConfirmation({
    sessions,
    drafts,
    categoryOptions,
    updateSession,
    onAllImported: () => navigate(AFTER_IMPORT_ROUTE),
  });

  // Index of the session whose inline "add bank" form is open
  const [addingBankSessionIdx, setAddingBankSessionIdx] = useState<number | null>(null);

  // Sessions that arrive through the navigation state (from ExtratoUploadModal) are checked once
  const initialCheckedRef = useRef(false);
  useEffect(() => {
    if (initialSessions.length > 0 && !initialCheckedRef.current) {
      initialCheckedRef.current = true;
      void checkSessions(initialSessions).then(setSessions);
    }
    // runs once for the sessions the page was opened with
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBankSelect = (sIdx: number, value: string) => {
    if (value === ADD_BANK_OPTION) {
      setAddingBankSessionIdx(sIdx);
    } else {
      updateSession(sIdx, { bankCode: value });
      setAddingBankSessionIdx(null);
    }
  };

  const handleAddBank = async (sIdx: number, bankCode: string, bankName: string) => {
    if (!bankCode.trim() || !bankName.trim()) {
      toast({ title: 'Erro', description: 'Preencha código e nome do banco.', variant: 'destructive' });
      return;
    }
    try {
      const created = await addBank.mutateAsync({ bank_code: bankCode.trim(), bank_name: bankName.trim() });
      updateSession(sIdx, { bankCode: created.bank_code });
      setAddingBankSessionIdx(null);
      toast({ title: 'Banco adicionado', description: `${created.bank_name} (${created.bank_code})` });
    } catch {
      toast({ title: 'Erro', description: 'Falha ao adicionar banco.', variant: 'destructive' });
    }
  };

  const handleCancel = () => {
    setSessions([]);
    navigate(AFTER_IMPORT_ROUTE);
  };

  if (sessions.length === 0) {
    return (
      <ExtractUploadStep
        isUploading={upload.isUploading}
        uploadProgress={upload.uploadProgress}
        onFilesSelected={upload.handleFiles}
        onBack={() => navigate(AFTER_IMPORT_ROUTE)}
      />
    );
  }

  const summary = summarizeSessions(sessions);
  const pendingSessions = sessions.filter((s) => !s.isConfirmed).length;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <ExtractReviewHeader
          fileCount={sessions.length}
          transactionCount={summary.total}
          pendingSessions={pendingSessions}
          isConfirming={confirmation.isConfirming}
          onCancel={handleCancel}
          onConfirmAll={confirmation.confirmAll}
        />

        <ExtractSummaryCards summary={summary} />

        <ExtractDuplicatesSection
          items={duplicateItems}
          onKeepExisting={skipDuplicate}
          onReplace={replaceDuplicate}
        />

        <div className="space-y-6">
          {sessions.map((session, sIdx) => (
            <ExtractSessionCard
              key={sIdx}
              session={session}
              sIdx={sIdx}
              banks={banks}
              categoryOptions={categoryOptions}
              drafts={drafts}
              isConfirming={confirmation.isConfirming}
              isAddingBank={addingBankSessionIdx === sIdx}
              rowActions={(rIdx) => rowActions(sIdx, rIdx)}
              onBankSelect={(value) => handleBankSelect(sIdx, value)}
              onAddBank={(code, name) => handleAddBank(sIdx, code, name)}
              onCancelAddBank={() => setAddingBankSessionIdx(null)}
              onConfirm={() => confirmation.confirmSession(sIdx)}
            />
          ))}
        </div>

        {pendingSessions > 0 && (
          <ExtractConfirmBar
            pendingSessions={pendingSessions}
            pendingTransactions={summary.pendingTransactions}
            isConfirming={confirmation.isConfirming}
            onConfirmAll={confirmation.confirmAll}
          />
        )}
      </main>
    </div>
  );
};

export default BankExtract;
