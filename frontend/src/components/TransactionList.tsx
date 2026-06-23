// TransactionList.tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  MoreVertical,
  Edit,
  Trash2,
  FileText,
  Banknote,
  Search,
} from 'lucide-react';
import { Transaction, MonthlyBalance } from '@/types/financial';
import { AnimatedNumber } from './AnimatedNumber';
import { AddTransactionDialog } from './AddTransactionDialog';
import { EditTransactionDialog } from './EditTransactionDialog';
import { ExtratoDialog } from './ExtratoDialog';
import { SettingsService, UserBank } from '@/services/settingsService';
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
  onReload?: () => void;
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
  onReload,
}: TransactionListProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [extratoOpen, setExtratoOpen] = useState(false);
  const [banks, setBanks] = useState<UserBank[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Reload banks whenever transactions change (new bank may have been added inline)
  useEffect(() => {
    SettingsService.listBanks().then(setBanks).catch(() => {});
  }, [transactions]);

  const getBankName = (bankCode: string | null): string | null => {
    if (!bankCode) return null;
    const bank = banks.find(b => b.bank_code === bankCode);
    return bank?.bank_name || null;
  };

  const BANK_LOGO_CDN = 'https://cdn.jsdelivr.net/gh/wesguirra/brazil-bank-data@main/bank-logos/256/png';

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
            onClick={() => setExtratoOpen(true)}
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

      {/* Lista de Transações */}
      <div className="flex-1 overflow-y-auto mt-3 space-y-2">
        {transactions
          .filter(t => {
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase();
            return (
              t.descricao.toLowerCase().includes(q) ||
              t.categoria_nome.toLowerCase().includes(q) ||
              t.subcategoria_nome.toLowerCase().includes(q) ||
              t.forma_pagamento.toLowerCase().includes(q) ||
              t.valor.toString().includes(q) ||
              (t.bank_code || '').toLowerCase().includes(q) ||
              (getBankName(t.bank_code) || '').toLowerCase().includes(q)
            );
          })
          .map((t, idx) => {
            const bankName = getBankName(t.bank_code);
          return (
            <div
              key={t.id}
              className={`animate-slide-up bg-card border border-border rounded-lg p-4 cursor-pointer hover:bg-muted transition-colors ${
                t.conta_recorrente_id ? 'bg-blue-50/60 border-blue-200 hover:bg-blue-50' : ''
              }`}
              style={{ animationDelay: `${idx * 50}ms` }}
              onClick={() => handleItemClick(t.id)}
            >
              {/* Top row: icon + description + value + delete */}
              <div className="flex items-start gap-3">
                <div className={cn(
                  "p-2 rounded-lg shrink-0",
                  t.conta_recorrente_id ? 'bg-blue-100 text-blue-600' :
                  t.tipo === 'entrada' ? 'bg-success/10 text-success' : 
                  t.tipo === 'investimento' ? 'bg-warning/10 text-warning' : 
                  'bg-destructive/10 text-destructive'
                )}>
                  {t.conta_recorrente_id ? <ArrowDownRight className="h-4 w-4" /> :
                   t.tipo === 'entrada' ? <ArrowUpRight className="h-4 w-4" /> : 
                   t.tipo === 'investimento' ? <ArrowUpRight className="h-4 w-4" /> : 
                   <ArrowDownRight className="h-4 w-4" />}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground truncate">{t.descricao}</p>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className={cn("font-semibold text-lg", 
                        t.conta_recorrente_id ? 'text-blue-600' :
                        t.tipo === 'entrada' ? 'text-success' : 
                        t.tipo === 'investimento' ? 'text-warning' : 
                        'text-destructive')}>
                        {formatCurrency(t.valor)}
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
                    {t.conta_recorrente_id ? (
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                        Recorrente
                      </span>
                    ) : (
                      <Badge variant='outline' className="shrink-0">
                        {format(new Date(t.data_transacao), 'dd/MM/yyyy')}
                      </Badge>
                    )}
                    {t.total_parcelas && t.total_parcelas > 1 && !t.conta_recorrente_id && (
                      <Badge className="shrink-0">
                        {t.parcela}/{t.total_parcelas}
                      </Badge>
                    )}
                    {t.bank_code && bankName && (
                      <span className="shrink-0" title={bankName}>
                        {!logoErrors.has(t.bank_code) ? (
                          <img
                            src={`${BANK_LOGO_CDN}/${t.bank_code.padStart(3, '0')}.png`}
                            alt={bankName}
                            className="w-4 h-4 rounded object-contain bg-card"
                            onError={() => setLogoErrors((prev) => new Set(prev).add(t.bank_code!))}
                          />
                        ) : (
                          <span className="text-[8px] font-bold text-muted-foreground border rounded px-0.5">{t.bank_code}</span>
                        )}
                      </span>
                    )}
                    {!t.conta_recorrente_id && (
                      <span className="text-slate-400 truncate">• {t.categoria_nome}</span>
                    )}
                    {t.conta_recorrente_id && (
                      <span className="text-blue-400 truncate">• {t.categoria_nome}</span>
                    )}
                  </div>
                </div>
              </div>

            </div>
          );
        })}
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

      <ExtratoDialog
        open={extratoOpen}
        onOpenChange={setExtratoOpen}
        onImported={() => onReload?.()}
      />
    </div>
  );
}
