// BankBreakdownModal.tsx
import { useState, type LucideIcon } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const BANK_LOGO_CDN = 'https://cdn.jsdelivr.net/gh/wesguirra/brazil-bank-data@main/bank-logos/256/png';

export interface BankBreakdownItem {
  bank_code: string;
  bank_name: string;
  amount: number;
}

type ModalTheme = 'primary' | 'success' | 'destructive' | 'warning';

interface BankBreakdownModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  total: number;
  items: BankBreakdownItem[];
  icon: LucideIcon;
  theme: ModalTheme;
}

const themeStyles: Record<ModalTheme, {
  headerBg: string;
  headerText: string;
  iconColor: string;
  rowHover: string;
  progressBg: string;
  progressFill: string;
}> = {
  primary: {
    headerBg: 'bg-primary/10',
    headerText: 'text-primary',
    iconColor: 'text-primary/70',
    rowHover: 'hover:bg-primary/5',
    progressBg: 'bg-primary/15',
    progressFill: 'bg-primary',
  },
  success: {
    headerBg: 'bg-success/10',
    headerText: 'text-success',
    iconColor: 'text-success/70',
    rowHover: 'hover:bg-success/5',
    progressBg: 'bg-success/15',
    progressFill: 'bg-success',
  },
  destructive: {
    headerBg: 'bg-destructive/10',
    headerText: 'text-destructive',
    iconColor: 'text-destructive/70',
    rowHover: 'hover:bg-destructive/5',
    progressBg: 'bg-destructive/15',
    progressFill: 'bg-destructive',
  },
  warning: {
    headerBg: 'bg-warning/10',
    headerText: 'text-warning',
    iconColor: 'text-warning/70',
    rowHover: 'hover:bg-warning/5',
    progressBg: 'bg-warning/15',
    progressFill: 'bg-warning',
  },
};

export function BankBreakdownModal({
  open,
  onClose,
  title,
  total,
  items,
  icon: Icon,
  theme,
}: BankBreakdownModalProps) {
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const sorted = [...items].sort((a, b) => b.amount - a.amount);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'BRL' }).format(amount);

  const style = themeStyles[theme];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-sm p-0 gap-0 overflow-hidden">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {/* Header com cor do card */}
        <div className={cn('flex items-center gap-3 px-5 py-4', style.headerBg)}>
          <div className={cn('p-2 rounded-lg bg-background/80', style.iconColor)}>
            <Icon className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{title}</p>
            <p className={cn('text-xl font-bold', style.headerText)}>
              {formatCurrency(total)}
            </p>
          </div>
        </div>

        {/* Tabela */}
        <div className="px-0 py-2">
          {/* Linhas */}
          <div className="max-h-64 overflow-y-auto divide-y divide-border/50">
            {sorted.map((item, idx) => {
              const pct = total > 0 ? (item.amount / total) * 100 : 0;
              return (
                <div
                  key={item.bank_code}
                  title={item.bank_name}
                  className={cn(
                    'flex items-center gap-3 px-5 py-3 transition-colors',
                    style.rowHover,
                  )}
                >
                  {/* Logo */}
                  <div className="w-8 flex justify-center shrink-0">
                    {!logoErrors.has(item.bank_code) ? (
                      <img
                        src={`${BANK_LOGO_CDN}/${item.bank_code.padStart(3, '0')}.png`}
                        alt={item.bank_name}
                        className="w-6 h-6 rounded object-contain"
                        onError={() => setLogoErrors((prev) => new Set(prev).add(item.bank_code))}
                      />
                    ) : (
                      <span className="w-6 h-6 rounded bg-muted text-muted-foreground font-bold text-[10px] flex items-center justify-center">
                        {item.bank_code}
                      </span>
                    )}
                  </div>

                  {/* Barra de progresso */}
                  <div className="flex-1 min-w-0">
                    <div className={cn('w-full rounded-full h-2', style.progressBg)}>
                      <div
                        className={cn('h-full rounded-full transition-all', style.progressFill)}
                        style={{ width: `${Math.min(100, pct)}%` }}
                      />
                    </div>
                  </div>

                  {/* Valor */}
                  <span className="text-sm font-semibold tabular-nums text-right whitespace-nowrap shrink-0">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              );
            })}
          </div>

          {sorted.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum dado disponível.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
