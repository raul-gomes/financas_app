import { CheckCircle, FileText, Loader2, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BankLogo } from '@/components/ui/bank-logo';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ADD_BANK_OPTION, formatTransactionCount } from '@/lib/extractReview';
import type { UserBank } from '@/services/settingsService';
import type { SessionData } from '@/types/extract';

interface ExtractSessionHeaderProps {
  session: SessionData;
  banks: UserBank[];
  isConfirming: boolean;
  onBankSelect: (value: string) => void;
  onConfirm: () => void;
}

/** File name, row count, bank select and the "Confirmar" button of one session. */
export function ExtractSessionHeader({ session, banks, isConfirming, onBankSelect, onConfirm }: ExtractSessionHeaderProps) {
  const hasBank = !!session.bankCode;
  const isPending = !session.isConfirmed;

  return (
    <div className={`px-4 py-3 flex items-center gap-3 flex-wrap ${session.isConfirmed ? 'bg-success/10' : 'bg-warning/10'}`}>
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <FileText className="w-5 h-5 shrink-0 text-muted-foreground" />
        <span className="font-semibold text-sm truncate">{session.filename}</span>
        {session.isConfirmed && (
          <span className="bg-success text-success-foreground text-xs px-2 py-0.5 rounded-full shrink-0">
            Confirmado ✓
          </span>
        )}
        <span className="text-xs text-muted-foreground shrink-0">{formatTransactionCount(session.transactions.length)}</span>
      </div>

      <div className="flex items-center gap-2 max-sm:w-full sm:shrink-0">
        <span className="text-xs text-muted-foreground">Banco:</span>
        <Select value={session.bankCode} onValueChange={onBankSelect} disabled={session.isConfirmed}>
          <SelectTrigger
            className={`h-8 text-xs max-sm:min-w-0 max-sm:flex-1 sm:min-w-[180px] ${
              !hasBank && isPending ? 'border-warning border-2' : ''
            }`}
          >
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {banks.map((b) => (
              <SelectItem key={b.id} value={b.bank_code}>
                <div className="flex items-center gap-2">
                  <BankLogo code={b.bank_code} size="xs" />
                  <span>
                    {b.bank_name} ({b.bank_code})
                  </span>
                </div>
              </SelectItem>
            ))}
            <SelectItem value={ADD_BANK_OPTION}>
              <div className="flex items-center gap-2 text-primary font-medium">
                <Plus className="w-4 h-4" />
                <span>Adicionar novo banco</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>

        {isPending && (
          <Button
            size="sm"
            disabled={!hasBank || isConfirming}
            onClick={onConfirm}
            className={hasBank ? 'bg-warning hover:bg-warning/90' : ''}
          >
            {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            <span className="ml-1">Confirmar</span>
          </Button>
        )}
      </div>
    </div>
  );
}
