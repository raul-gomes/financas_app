import { Card } from '@/components/ui/card';
import { formatCurrency } from '@/lib/format';

interface FixedVariableCardProps {
  fixedExpenses: number;
  variableExpenses: number;
}

/** Fixed vs variable expenses of the period, as two values over a split bar. */
export function FixedVariableCard({ fixedExpenses, variableExpenses }: FixedVariableCardProps) {
  const total = fixedExpenses + variableExpenses;
  const fixedShare = total > 0 ? (fixedExpenses / total) * 100 : 0;
  const variableShare = total > 0 ? (variableExpenses / total) * 100 : 0;
  return (
    <Card className="shadow-card border-none flex-shrink-0">
      <div className="p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3">Gastos Fixos vs Variáveis</h3>
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span className="text-success font-medium">Fixos: {formatCurrency(fixedExpenses)}</span>
              <span className="text-warning font-medium">Variáveis: {formatCurrency(variableExpenses)}</span>
            </div>
            <div className="w-full bg-muted rounded-full h-3 flex overflow-hidden">
              <div className="bg-success transition-all duration-700 ease-out" style={{ width: `${fixedShare}%` }} />
              <div className="bg-warning transition-all duration-700 ease-out" style={{ width: `${variableShare}%` }} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
