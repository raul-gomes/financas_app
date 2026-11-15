import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ExtractConfirmBarProps {
  pendingSessions: number;
  pendingTransactions: number;
  isConfirming: boolean;
  onConfirmAll: () => void;
}

/** Sticky bar at the bottom of the review: what is left to import and "Confirmar Tudo". */
export function ExtractConfirmBar({
  pendingSessions,
  pendingTransactions,
  isConfirming,
  onConfirmAll,
}: ExtractConfirmBarProps) {
  return (
    <div className="sticky bottom-0 mt-6 bg-card border border-border rounded-lg p-4 flex justify-between items-center shadow-lg">
      <span className="text-sm text-muted-foreground">
        {pendingSessions} sessão(ões) pendente(s) — {pendingTransactions} transações
      </span>
      <Button onClick={onConfirmAll} disabled={isConfirming} className="bg-gradient-primary">
        {isConfirming ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        {isConfirming ? 'Importando...' : `Confirmar Tudo (${pendingSessions})`}
      </Button>
    </div>
  );
}
