import { AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/format';
import type { CategoryRiskResponse } from '@/types/notifications';

const BANNER_STYLES = {
  warning: 'border-warning/30 bg-warning/15 text-warning',
  critical: 'border-critical/30 bg-critical/15 text-critical',
  destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
} as const;

interface CategoryRiskBannerProps {
  risk: CategoryRiskResponse | null;
}

/** Non-blocking warning: how much of the category limit this expense would use (hidden when there is no limit or no risk). */
export function CategoryRiskBanner({ risk }: CategoryRiskBannerProps) {
  if (!risk || risk.limit <= 0) return null;
  const severity = risk.severity ?? (risk.is_over_limit ? 'destructive' : null);
  if (!severity) return null;
  return (
    <div
      role="alert"
      data-testid="category-risk-banner"
      data-severity={severity}
      className={`flex items-start gap-2 rounded-lg border p-3 ${BANNER_STYLES[severity]}`}
    >
      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
      <div className="text-sm space-y-1">
        <p className="font-medium">
          {risk.is_over_limit
            ? `Adicionar estourará o limite de "${risk.category_name}"`
            : `Atenção no limite de "${risk.category_name}"`}
        </p>
        <p className="text-xs opacity-90">
          Gasto atual {formatCurrency(risk.spent)} + {formatCurrency(risk.amount)} = {formatCurrency(risk.projected_spent)} →{' '}
          {risk.projected_percent_used.toFixed(0)}% do limite{risk.is_over_limit ? '. Segure a mão!' : ''}
        </p>
      </div>
    </div>
  );
}
