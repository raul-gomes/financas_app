// TransactionList.tsx
import { useState, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { formatCurrency } from '@/lib/format';
import { useNavigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Trash2,
  FileText,
  Search,
} from 'lucide-react';
import { Transaction, MonthlyBalance } from '@/types/financial';
import { EmptyState } from '@/components/ui/empty-state';
import { BankLogo } from '@/components/ui/bank-logo';
import { AnimatedNumber } from './AnimatedNumber';
import { AddTransactionDialog } from '@/components/dialogs/AddTransactionDialog';
import { EditTransactionDialog } from '@/components/dialogs/EditTransactionDialog';
import { ExtratoUploadModal } from '@/components/dialogs/ExtratoUploadModal';
import { useTransactionList } from '@/hooks/useTransactionList';
import { useRole } from '@/contexts/RoleContext';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface TransactionListProps {
  monthlyBalance: MonthlyBalance;
  onAddTransaction: (transaction: Transaction) => void;
  onEditTransaction: (id: number, transaction: Partial<Transaction>) => void;
  onDeleteTransaction: (id: number) => void;
  dateRange: { from: Date; to: Date };
  selectedEntityType: 'all' | 'pf' | 'pj';
  onEntityTypeChange: (type: 'all' | 'pf' | 'pj') => void;
}

export function TransactionList({
  monthlyBalance,
  onAddTransaction,
  onEditTransaction,
  onDeleteTransaction,
  dateRange,
  selectedEntityType,
  onEntityTypeChange,
}: TransactionListProps) {
  const navigate = useNavigate();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const { isAdmin } = useRole();

  // Server-paged list (period + PF/PJ + text search) and bank names, shared with the mobile view
  const {
    searchQuery,
    setSearchQuery,
    transactions,
    total,
    isPending,
    isError,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    getBankName,
  } = useTransactionList(dateRange, selectedEntityType);

  // Virtualização: apenas linhas visíveis (+ overscan) são montadas no DOM
  const listRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: transactions.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 96,
    overscan: 6,
  });


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
      <div className="grid grid-cols-2 gap-4 mb-2">
          <div className="bg-success/10 border border-success/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <ArrowUpRight className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Entradas</p>
                <p className="text-lg font-semibold text-success">
                  <AnimatedNumber value={monthlyBalance.income} withDelay={100} />
                </p>
              </div>
            </div>
          </div>
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <ArrowDownRight className="h-5 w-5 text-destructive" />
              <div>
                <p className="text-sm text-muted-foreground">Saídas</p>
                <p className="text-lg font-semibold text-destructive">
                  <AnimatedNumber value={monthlyBalance.expenses} withDelay={250} />
                </p>
              </div>
            </div>
          </div>
      </div>
      {/* Balanço Mensal */}
      <div className={cn(
        "rounded-lg p-3 mb-4 text-center text-sm font-semibold transition-colors",
        monthlyBalance.balance >= 0
          ? "bg-success/5 text-success border border-success/20"
          : "bg-destructive/5 text-destructive border border-destructive/20"
      )}>
        Balanço Mensal: {formatCurrency(monthlyBalance.balance)}
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
          <Button
            onClick={() => setUploadOpen(true)}
            variant="outline"
            size="sm"
          >
            <FileText className="h-4 w-4 mr-1" />
            Extrato
          </Button>
        </div>
      </div>

      {/* Busca */}
      <div className="relative mt-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Pesquisar por descrição, categoria, valor..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {isPending && (
        <p role="status" className="mt-3 text-sm text-muted-foreground">Carregando transações...</p>
      )}
      {isError && (
        <EmptyState title="Erro ao carregar as transações" description="Não foi possível buscar o extrato.">
          <Button variant="outline" size="sm" onClick={() => refetch()}>Tentar novamente</Button>
        </EmptyState>
      )}
      {!isPending && !isError && transactions.length === 0 && (
        <EmptyState title="Nenhuma transação encontrada" />
      )}

      {/* Lista de Transações (virtualizada) */}
      <div ref={listRef} className="flex-1 min-h-0 overflow-y-auto mt-3">
        <div style={{ height: rowVirtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
          {rowVirtualizer.getVirtualItems().map((virtualRow) => {
            const t = transactions[virtualRow.index];
            const bankName = getBankName(t.bank_code);
            return (
              <div
                key={t.id}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
                className="absolute left-0 top-0 w-full pb-2"
                style={{ transform: `translateY(${virtualRow.start}px)` }}
                onClick={() => handleItemClick(t.id)}
              >
                <div
                  className={`bg-card border border-border rounded-lg p-4 cursor-pointer hover:bg-muted transition-colors ${
                    t.recurring_account_id ? 'bg-primary/5 border-primary/30 hover:bg-primary/10' : ''
                  }`}
                >
                  {/* Top row: icon + description + value + delete */}
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "p-2 rounded-lg shrink-0",
                      t.recurring_account_id ? 'bg-primary/15 text-primary' :
                      t.type === 'income' ? 'bg-success/10 text-success' : 
                      t.type === 'investment' ? 'bg-warning/10 text-warning' : 
                      'bg-destructive/10 text-destructive'
                    )}>
                      {t.recurring_account_id ? <ArrowDownRight className="h-4 w-4" /> :
                      t.type === 'income' ? <ArrowUpRight className="h-4 w-4" /> : 
                      t.type === 'investment' ? <ArrowUpRight className="h-4 w-4" /> : 
                      <ArrowDownRight className="h-4 w-4" />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-foreground truncate">{t.description}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          <p className={cn("font-semibold text-lg", 
                            t.recurring_account_id ? 'text-primary' :
                            t.type === 'income' ? 'text-success' : 
                            t.type === 'investment' ? 'text-warning' : 
                            'text-destructive')}>
                            {formatCurrency(t.amount)}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10 focus-visible:bg-destructive/20 shrink-0"
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

                      {/* Bottom row: badges */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground mt-1">
                        {t.recurring_account_id ? (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary/15 text-primary">
                            Recorrente
                          </span>
                        ) : (
                          <Badge variant='outline' className="shrink-0">
                            {format(new Date(t.transaction_date), 'dd/MM/yyyy')}
                          </Badge>
                        )}
                        {t.total_installments && t.total_installments > 1 && !t.recurring_account_id && (
                          <Badge className="shrink-0">
                            {t.installment_number}/{t.total_installments}
                          </Badge>
                        )}
                        {t.bank_code && bankName && (
                          <span className="shrink-0" title={bankName}>
                            <BankLogo code={t.bank_code} size="xs" alt={bankName} />
                          </span>
                        )}
                        {!t.recurring_account_id && (
                          <span className="text-muted-foreground truncate">• {t.category_name}</span>
                        )}
                        {t.recurring_account_id && (
                          <span className="text-primary/80 truncate">• {t.category_name}</span>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>

      {transactions.length > 0 && (
        <div className="flex items-center justify-center gap-3 pt-2 text-xs text-muted-foreground">
          <span>Mostrando {transactions.length} de {total}</span>
          {hasNextPage && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => fetchNextPage()}
              disabled={isFetchingNextPage}
            >
              {isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
            </Button>
          )}
        </div>
      )}

      {/* Modais */}
      {editingTransaction && (
        <EditTransactionDialog
          isOpen={!!editingTransaction}
          onClose={() => setEditingTransaction(null)}
          transaction={editingTransaction}
          onEditTransaction={async (updatedTransaction) => {
            if (editingTransaction) {
              await onEditTransaction(editingTransaction.id, updatedTransaction);
              setEditingTransaction(null);
            }
          }}
        />
      )}

      {isAdmin && (
        <ExtratoUploadModal
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onUploadComplete={(sessions) => {
            setUploadOpen(false)
            navigate('/extrato-bancario', { state: { sessions } })
          }}
        />
      )}
    </div>
  );
}
