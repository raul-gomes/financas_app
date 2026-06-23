// BankBreakdownModal.tsx
import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { UserBank } from '@/services/settingsService';

const BANK_LOGO_CDN = 'https://cdn.jsdelivr.net/gh/wesguirra/brazil-bank-data@main/bank-logos/256/png';

export interface BankBreakdownItem {
  bank_code: string;
  bank_name: string;
  amount: number;
}

interface BankBreakdownModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  items: BankBreakdownItem[];
}

export function BankBreakdownModal({
  open,
  onClose,
  title,
  items,
}: BankBreakdownModalProps) {
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const sorted = [...items].sort((a, b) => b.amount - a.amount);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {sorted.map((item) => (
            <div
              key={item.bank_code}
              className="flex items-center justify-between rounded-lg border bg-card px-3 py-2.5"
            >
              <div className="flex items-center gap-2">
                {!logoErrors.has(item.bank_code) ? (
                  <img
                    src={`${BANK_LOGO_CDN}/${item.bank_code.padStart(3, '0')}.png`}
                    alt={item.bank_name}
                    className="w-5 h-5 rounded object-contain bg-card"
                    onError={() => setLogoErrors((prev) => new Set(prev).add(item.bank_code))}
                  />
                ) : (
                  <span className="w-5 h-5 rounded bg-primary/10 text-primary font-bold text-[9px] flex items-center justify-center">
                    {item.bank_code}
                  </span>
                )}
                <span className="text-sm font-medium">{item.bank_name}</span>
              </div>
              <span className="text-sm font-semibold tabular-nums">
                {formatCurrency(item.amount)}
              </span>
            </div>
          ))}
          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum dado disponível.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
