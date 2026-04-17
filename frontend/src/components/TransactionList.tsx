// TransactionList.tsx
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
} from 'lucide-react';
import { Transaction, MonthlyBalance } from '@/types/financial';
import { AddTransactionDialog } from './AddTransactionDialog';
import { EditTransactionDialog } from './EditTransactionDialog';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TransactionListProps {
  transactions: Transaction[];
  monthlyBalance: MonthlyBalance;
  onAddTransaction: (transaction: Transaction) => void;
  onEditTransaction: (id: number, transaction: Partial<Transaction>) => void;
  onDeleteTransaction: (id: number) => void;
  dateRange: { from: Date; to: Date };
  selectedEntityType: 'all' | 'pf' | 'pj';
  onEntityTypeChange: (type: 'all' | 'pf' | 'pj') => void;
}

export function TransactionList({
  transactions,
  monthlyBalance,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  dateRange,
  selectedEntityType,
  onEntityTypeChange,
}: TransactionListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const { toast } = useToast();

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);

  const handleEditTransaction = (id: number) => {
    const transaction = transactions.find(t => t.id === id);
    if (transaction) {
      setEditingTransaction(transaction);
    }
  };

  const handleItemClick = (id: number) => {
    handleEditTransaction(id);
  };

  return (
    <div className="h-full flex flex-col p-6">
      {/* Indicadores de Balanço */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-success/10 border border-success/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ArrowUpRight className="h-5 w-5 text-success" />
            <div>
              <p className="text-sm text-muted-foreground">Entradas</p>
              <p className="text-lg font-semibold text-success">{formatCurrency(monthlyBalance.income)}</p>
            </div>
          </div>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <ArrowDownRight className="h-5 w-5 text-destructive" />
            <div>
              <p className="text-sm text-muted-foreground">Saídas</p>
              <p className="text-lg font-semibold text-destructive">{formatCurrency(monthlyBalance.expenses)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Header e Botões */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">Extrato Financeiro</h2>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted rounded-lg p-1">
            <button
              onClick={() => onEntityTypeChange('pf')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                selectedEntityType === 'pf' ?
                  'bg-card text-foreground shadow-sm' :
                  'text-muted-foreground hover:text-foreground'
              )}
            >
              PF
            </button>
            <button
              onClick={() => onEntityTypeChange('pj')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-md transition-colors',
                selectedEntityType === 'pj' ?
                  'bg-card text-foreground shadow-sm' :
                  'text-muted-foreground hover:text-foreground'
              )}
            >
              PJ
            </button>
          </div>
          <AddTransactionDialog
            isOpen={isDialogOpen}
            onClose={() => setIsDialogOpen(false)}
            onAddTransaction={onAddTransaction}
          />
          <Button
            onClick={() => setIsDialogOpen(true)}
            size="sm"
            className="bg-gradient-primary hover:opacity-90"
          >
            <Plus className="h-4 w-4 mr-1" />
            Nova
          </Button>
        </div>
      </div>

      {/* Lista de Transações */}
      <div className="flex-1 overflow-y-auto mt-4 space-y-2">
        {transactions.map((t) => (
          <div
            key={t.id}
            className="bg-card border border-border rounded-lg p-4 cursor-pointer hover:bg-muted transition-colors"
            onClick={() => handleItemClick(t.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "p-2 rounded-lg",
                  t.tipo === 'entrada' ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                )}>
                  {t.tipo === 'entrada' ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                </div>

                <div className="flex-1">
                  <p className="font-medium text-foreground">{t.descricao}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Badge variant='outline'><span>{format(new Date(t.data_transacao), 'dd/MM/yyyy')}</span></Badge>
                    <Badge variant={t.natureza === 'pj' ? 'default' : 'secondary'} className="text-xs">
                      {t.natureza.toUpperCase()}
                    </Badge>
                    <span>{t.total_parcelas && t.total_parcelas > 1 && (
                      <span>
                        <Badge>
                          {t.parcela}/{t.total_parcelas}
                        </Badge>
                      </span>
                    )}</span>
                    <span className="text-slate-400">• {t.categoria_nome}</span>
                  </div>
                </div>
              </div>
                          <div>
              <p className={cn("mt-2 font-semibold text-lg", t.tipo === 'entrada' ? 'text-success' : 'text-destructive')}>
                {t.tipo === 'entrada' ? '' : ''}{formatCurrency(t.valor)}
              </p>
            </div>

              {/* Somente botão excluir */}
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/20"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteTransaction(t.id)
                }}
                aria-label="Excluir transação"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

          </div>
        ))}
      </div>

      {/* Modais */}
      <AddTransactionDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onAddTransaction={onAddTransaction}
      />

      {editingTransaction && (
        <EditTransactionDialog
          isOpen={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          transaction={editingTransaction}
          onEditTransaction={(updatedTransaction) => {
            if (editingTransaction) {
              onEditTransaction(editingTransaction.id, updatedTransaction);
              setEditingTransaction(null);
            }
          }}
        />
      )}
    </div>
  );
}
