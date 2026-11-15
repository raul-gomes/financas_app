import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { MoreHorizontal, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { TransactionRowMobile } from '@/components/transactions/TransactionRowMobile';
import { TransactionDetailSheet } from '@/components/transactions/TransactionDetailSheet';
import { EditTransactionDialog } from '@/components/dialogs/EditTransactionDialog';
import { ExtratoUploadModal } from '@/components/dialogs/ExtratoUploadModal';
import { useTransactionList } from '@/hooks/useTransactionList';
import { useRole } from '@/contexts/RoleContext';
import { groupTransactionsByDay } from '@/lib/transactionGroups';
import type { Transaction } from '@/types/financial';

type EntityScope = 'all' | 'pf' | 'pj';

const ENTITY_OPTIONS = [
  { value: 'pf', label: 'PF' },
  { value: 'pj', label: 'PJ' },
] as const;

interface TransactionListMobileProps {
  onEditTransaction: (id: number, transaction: Partial<Transaction>) => void | Promise<void>;
  onDeleteTransaction: (id: number) => Promise<void>;
  dateRange: { from: Date; to: Date };
  selectedEntityType: EntityScope;
  onEntityTypeChange: (type: EntityScope) => void;
}

/**
 * Transactions list for screens below `md`: "Lançamentos" header with the statement
 * import action (admins), search + PF/PJ, rows grouped by day and a detail sheet with
 * Editar/Excluir (no per-row trash button).
 */
export function TransactionListMobile({
  onEditTransaction,
  onDeleteTransaction,
  dateRange,
  selectedEntityType,
  onEntityTypeChange,
}: TransactionListMobileProps) {
  const navigate = useNavigate();
  const { isAdmin } = useRole();
  const list = useTransactionList(dateRange, selectedEntityType);
  const [opened, setOpened] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);

  const groups = useMemo(() => groupTransactionsByDay(list.transactions, new Date()), [list.transactions]);

  return (
    <section aria-label="Lançamentos" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground">Lançamentos</h2>
        {isAdmin && (
          <Button variant="ghost" size="sm" onClick={() => setUploadOpen(true)} className="font-semibold text-primary">
            <MoreHorizontal aria-hidden="true" />
            Extrato
          </Button>
        )}
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Buscar lançamentos"
            placeholder="Buscar"
            value={list.searchQuery}
            onChange={(e) => list.setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <SegmentedControl
          aria-label="Tipo de conta"
          options={ENTITY_OPTIONS}
          value={selectedEntityType === 'pj' ? 'pj' : 'pf'}
          onChange={onEntityTypeChange}
          className="shrink-0"
        />
      </div>

      {list.isPending && (
        <p role="status" className="text-sm text-muted-foreground">
          Carregando transações...
        </p>
      )}
      {list.isError && (
        <EmptyState title="Erro ao carregar as transações" description="Não foi possível buscar o extrato.">
          <Button variant="outline" size="sm" onClick={() => list.refetch()}>
            Tentar novamente
          </Button>
        </EmptyState>
      )}
      {!list.isPending && !list.isError && list.transactions.length === 0 && (
        <EmptyState title="Nenhuma transação encontrada" />
      )}

      {groups.map((group) => (
        <div key={group.key} className="space-y-1">
          <h3 className="px-0.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">{group.label}</h3>
          <div className="rounded-2xl border border-border bg-card px-3.5">
            {group.items.map((t) => (
              <TransactionRowMobile key={t.id} transaction={t} onOpen={setOpened} />
            ))}
          </div>
        </div>
      ))}

      {list.transactions.length > 0 && (
        <div className="flex flex-col items-center gap-2 pt-1 text-xs text-muted-foreground">
          <span>
            Mostrando {list.transactions.length} de {list.total}
          </span>
          {list.hasNextPage && (
            <Button variant="outline" size="sm" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
              {list.isFetchingNextPage ? 'Carregando...' : 'Carregar mais'}
            </Button>
          )}
        </div>
      )}

      {opened && (
        <TransactionDetailSheet
          transaction={opened}
          bankName={list.getBankName(opened.bank_code)}
          onClose={() => setOpened(null)}
          onEdit={(transaction) => {
            setOpened(null);
            setEditing(transaction);
          }}
          onDelete={onDeleteTransaction}
        />
      )}

      {editing && (
        <EditTransactionDialog
          isOpen
          onClose={() => setEditing(null)}
          transaction={editing}
          onEditTransaction={async (updated) => {
            await onEditTransaction(editing.id, updated);
            setEditing(null);
          }}
        />
      )}

      {isAdmin && (
        <ExtratoUploadModal
          open={uploadOpen}
          onOpenChange={setUploadOpen}
          onUploadComplete={(sessions) => {
            setUploadOpen(false);
            navigate('/extrato-bancario', { state: { sessions } });
          }}
        />
      )}
    </section>
  );
}
