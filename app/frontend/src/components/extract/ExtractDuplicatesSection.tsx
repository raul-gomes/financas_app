import { AlertCircle, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/format';
import type { DuplicateItem } from '@/lib/extractReview';
import { ExtractTypeBadge } from './ExtractTypeBadge';

interface ExtractDuplicatesSectionProps {
  items: DuplicateItem[];
  onKeepExisting: (key: string) => void;
  onReplace: (item: DuplicateItem) => void;
}

/** Rows that already exist in the database: keep the existing one or replace it with the upload. */
export function ExtractDuplicatesSection({ items, onKeepExisting, onReplace }: ExtractDuplicatesSectionProps) {
  return (
    <div className="space-y-4 mb-6">
      <div className="flex items-center gap-2">
        <AlertCircle className={`w-5 h-5 ${items.length > 0 ? 'text-warning' : 'text-muted-foreground'}`} />
        <h2 className="text-lg font-semibold">
          {items.length > 0 ? 'Transações Duplicadas Detectadas' : 'Verificação de Duplicatas'}
        </h2>
        {items.length > 0 && (
          <span className="text-sm text-muted-foreground">({items.filter((d) => !d.resolved).length} pendentes)</span>
        )}
      </div>

      {items.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-6 text-center text-muted-foreground">
          <CheckCircle className="w-8 h-8 mx-auto mb-2 text-success" />
          <p className="text-sm">Nenhuma duplicata encontrada. Todas as transações são inéditas.</p>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-warning/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-warning/10 border-b border-warning/30">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Data</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Descrição</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Valor</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Tipo</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Existente</th>
                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {items.map((item) => (
                  <DuplicateRow key={item.key} item={item} onKeepExisting={onKeepExisting} onReplace={onReplace} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

interface DuplicateRowProps {
  item: DuplicateItem;
  onKeepExisting: (key: string) => void;
  onReplace: (item: DuplicateItem) => void;
}

function DuplicateRow({ item, onKeepExisting, onReplace }: DuplicateRowProps) {
  const isResolved = !!item.resolved;
  const { transaction, existing } = item;
  return (
    <tr className={isResolved ? 'bg-success/5 opacity-70' : 'hover:bg-warning/5'}>
      <td className="px-3 py-2 text-xs whitespace-nowrap">{transaction.date}</td>
      <td className="px-3 py-2 text-xs max-w-[200px] truncate">{transaction.description}</td>
      <td
        className={`px-3 py-2 text-xs font-medium whitespace-nowrap ${
          transaction.type === 'income' ? 'text-success' : 'text-destructive'
        }`}
      >
        {transaction.type === 'expense' ? '-' : ''}
        {formatCurrency(transaction.amount)}
      </td>
      <td className="px-3 py-2">
        <ExtractTypeBadge type={transaction.type} />
      </td>
      <td className="px-3 py-2 text-xs">
        <div className="space-y-0.5">
          <span className="font-medium">{existing.description}</span>
          <div className="text-muted-foreground">
            {existing.transaction_date} — {formatCurrency(existing.amount)}
            {existing.category_name && <span> · {existing.category_name}</span>}
          </div>
        </div>
      </td>
      <td className="px-3 py-2">
        {isResolved ? (
          <span className="text-xs text-success font-medium">
            {item.resolved === 'skip' ? '✓ Ignorado' : '✓ Substituído'}
          </span>
        ) : (
          <div className="flex gap-1">
            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onKeepExisting(item.key)}>
              Manter existente
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs text-destructive border-destructive hover:bg-destructive/10"
              onClick={() => onReplace(item)}
            >
              Substituir
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}
