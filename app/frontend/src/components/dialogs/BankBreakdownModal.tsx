// BankBreakdownModal.tsx
import { type LucideIcon } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { DialogTitle } from '@/components/ui/dialog';
import { BankLogo } from '@/components/ui/bank-logo';
import { cn } from '@/lib/utils';

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
  const sorted = [...items].sort((a, b) => b.amount - a.amount);

  const style = themeStyles[theme];

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onClose}
      size="sm"
      className="p-0"
      bodyClassName="p-0"
    >
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
                    <BankLogo code={item.bank_code} size="md" alt={item.bank_name} />
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
    </ResponsiveModal>
  );
}
