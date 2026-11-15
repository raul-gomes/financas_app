import { ArrowLeft, CheckCircle, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExtractReviewHeaderProps {
  fileCount: number;
  transactionCount: number;
  pendingSessions: number;
  isConfirming: boolean;
  onCancel: () => void;
  onConfirmAll: () => void;
}

/** Title, counts and the page-level "Cancelar" / "Confirmar Tudo" buttons of the review. */
export function ExtractReviewHeader({
  fileCount,
  transactionCount,
  pendingSessions,
  isConfirming,
  onCancel,
  onConfirmAll,
}: ExtractReviewHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Revisar Extrato</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {fileCount} arquivo{fileCount > 1 ? 's' : ''} — {transactionCount} transações
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isConfirming}>
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
        {pendingSessions > 0 && (
          <Button onClick={onConfirmAll} disabled={isConfirming} size="sm" className="bg-gradient-primary">
            {isConfirming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
            {isConfirming ? 'Importando...' : `Confirmar Tudo (${pendingSessions})`}
          </Button>
        )}
      </div>
    </div>
  );
}
