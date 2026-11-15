import { formatCurrency } from '@/lib/format';
import type { SessionsSummary } from '@/lib/extractReview';

interface ExtractSummaryCardsProps {
  summary: SessionsSummary;
}

/** Counts and totals of everything being reviewed. */
export function ExtractSummaryCards({ summary }: ExtractSummaryCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
      <div className="bg-card rounded-lg p-4 border border-border">
        <p className="text-sm text-muted-foreground">Total</p>
        <p className="text-2xl font-bold">{summary.total}</p>
      </div>
      <div className="bg-card rounded-lg p-4 border border-border">
        <p className="text-sm text-muted-foreground">Entradas</p>
        <p className="text-2xl font-bold text-success">{summary.income}</p>
      </div>
      <div className="bg-card rounded-lg p-4 border border-border">
        <p className="text-sm text-muted-foreground">Saídas</p>
        <p className="text-2xl font-bold text-destructive">{summary.expense}</p>
      </div>
      <div className="bg-card rounded-lg p-4 border border-border">
        <p className="text-sm text-success">Total Entradas</p>
        <p className="text-lg font-bold text-success">{formatCurrency(summary.totalIncome)}</p>
        <p className="text-sm text-destructive">Total Saídas</p>
        <p className="text-lg font-bold text-destructive">{formatCurrency(summary.totalExpense)}</p>
      </div>
    </div>
  );
}
