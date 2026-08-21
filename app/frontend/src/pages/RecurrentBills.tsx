import { useState, useEffect, useCallback } from 'react';
import { formatCurrency } from '@/lib/format';
import { ContaRecorrente, ContaRecorrenteCreate, ContaRecorrenteUpdate } from '@/types/recurringAccount';
import { ContaRecorrenteService } from '@/services/recurringAccountService';
import { Button } from '@/components/ui/button';
import { Plus, RefreshCw, Wallet, ToggleRight, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AddRecurrentBillDialog } from '@/components/dialogs/AddRecurrentBillDialog';
import { EditRecurrentBillDialog } from '@/components/dialogs/EditRecurrentBillDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { StatCard } from '@/components/ui/stat-card';
import { RecurringBillsTable, currentInstallment, isEndingSoon } from '@/components/recorrentes/RecurringBillsTable';

const RecurrentBills = () => {
  const [contas, setContas] = useState<ContaRecorrente[]>([]);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaRecorrente | null>(null);
  const [renewingId, setRenewingId] = useState<number | null>(null);
  const [pendingToggle, setPendingToggle] = useState<ContaRecorrente | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);
  const { toast } = useToast();

  const loadContas = useCallback(async () => {
    try {
      const data = await ContaRecorrenteService.getAll();
      setContas(data);
    } catch (error) {
      console.error('Erro ao carregar contas recorrentes:', error);
      toast({ title: 'Erro', description: 'Falha ao carregar contas recorrentes.', variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => {
    loadContas();
  }, [loadContas]);

  const handleCreate = async (payload: ContaRecorrenteCreate) => {
    try {
      await ContaRecorrenteService.create(payload);
      toast({ title: 'Sucesso', description: 'Conta recorrente criada com 12 parcelas!' });
      setShowAddDialog(false);
      loadContas();
    } catch {
      toast({ title: 'Erro', description: 'Falha ao criar conta recorrente.', variant: 'destructive' });
    }
  };

  const handleUpdate = async (id: number, payload: ContaRecorrenteUpdate) => {
    try {
      await ContaRecorrenteService.update(id, payload);
      toast({ title: 'Sucesso', description: 'Conta recorrente atualizada!' });
      setShowEditDialog(false);
      setEditingConta(null);
      loadContas();
    } catch {
      toast({ title: 'Erro', description: 'Falha ao atualizar conta recorrente.', variant: 'destructive' });
    }
  };

  const doDelete = async (id: number) => {
    try {
      await ContaRecorrenteService.delete(id);
      toast({ title: 'Sucesso', description: 'Conta recorrente excluida!' });
      loadContas();
    } catch {
      toast({ title: 'Erro', description: 'Falha ao excluir conta recorrente.', variant: 'destructive' });
    }
  };

  const handleDelete = (id: number) => setPendingDeleteId(id);

  const doToggleActive = async (conta: ContaRecorrente) => {
    try {
      await ContaRecorrenteService.update(conta.id, { active: !conta.active });
      toast({
        title: 'Sucesso',
        description: conta.active
          ? `Conta desativada. ${conta.remaining_installments} parcelas futuras canceladas.`
          : 'Conta ativada.',
      });
      loadContas();
    } catch {
      toast({ title: 'Erro', description: 'Falha ao alterar status.', variant: 'destructive' });
    }
  };

  const handleToggleActive = (conta: ContaRecorrente) => setPendingToggle(conta);

  const handleRenew = async (id: number) => {
    setRenewingId(id);
    try {
      await ContaRecorrenteService.renew(id);
      toast({ title: 'Sucesso', description: 'Conta renovada por mais 12 meses!' });
      loadContas();
    } catch {
      toast({ title: 'Erro', description: 'Falha ao renovar conta.', variant: 'destructive' });
    } finally {
      setRenewingId(null);
    }
  };

  const activeContas = contas.filter((c) => c.active);
  const monthlyTotal = activeContas.reduce((sum, c) => sum + c.amount, 0);
  const endingCount = contas.filter(isEndingSoon).length;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <PageHeader
          title="Recurring Accounts"
          description="Gerencie suas despesas mensais fixas — cada conta gera 12 parcelas automaticamente"
          action={
            <Button onClick={() => setShowAddDialog(true)} className="bg-gradient-primary">
              <Plus className="w-4 h-4 mr-2" />
              Nova Conta Recorrente
            </Button>
          }
        />

        {contas.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <StatCard
              icon={Wallet}
              label="Total mensal ativo"
              value={formatCurrency(monthlyTotal)}
              hint={`${activeContas.length} conta(s) ativa(s)`}
            />
            <StatCard
              icon={ToggleRight}
              tone="success"
              label="Ativas"
              value={String(activeContas.length)}
              hint={`${contas.length - activeContas.length} inativa(s)`}
            />
            <StatCard
              icon={AlertTriangle}
              tone="warning"
              label="Acabando em breve"
              value={String(endingCount)}
              hint="A partir da 10ª parcela de 12"
            />
          </div>
        )}

        <div className="bg-card rounded-lg shadow-card border border-border overflow-hidden">
          {contas.length === 0 ? (
            <EmptyState
              icon={RefreshCw}
              title="Nenhuma conta recorrente cadastrada."
              description="Clique no botão acima para adicionar."
            />
          ) : (
            <RecurringBillsTable
              contas={contas}
              onToggleActive={handleToggleActive}
              onEdit={(conta) => {
                setEditingConta(conta);
                setShowEditDialog(true);
              }}
              onDelete={handleDelete}
              onRenew={handleRenew}
              renewingId={renewingId}
            />
          )}
        </div>

        {showAddDialog && (
          <AddRecurrentBillDialog
            isOpen={showAddDialog}
            onClose={() => setShowAddDialog(false)}
            onSubmit={handleCreate}
          />
        )}

        {showEditDialog && editingConta && (
          <EditRecurrentBillDialog
            isOpen={showEditDialog}
            onClose={() => {
              setShowEditDialog(false);
              setEditingConta(null);
            }}
            conta={editingConta}
            onSubmit={handleUpdate}
          />
        )}

        <ConfirmDialog
          open={pendingToggle !== null}
          onOpenChange={(open) => { if (!open) setPendingToggle(null); }}
          title={pendingToggle?.active ? 'Desativar conta recorrente?' : 'Ativar conta recorrente?'}
          description={
            pendingToggle?.active
              ? `Isso cancelará as ${pendingToggle.remaining_installments} parcelas futuras.`
              : undefined
          }
          confirmLabel={pendingToggle?.active ? 'Desativar' : 'Ativar'}
          destructive={!!pendingToggle?.active}
          onConfirm={() => { if (pendingToggle) void doToggleActive(pendingToggle); }}
        />

        <ConfirmDialog
          open={pendingDeleteId !== null}
          onOpenChange={(open) => { if (!open) setPendingDeleteId(null); }}
          title="Excluir esta conta recorrente?"
          description="Esta ação não pode ser desfeita."
          destructive
          confirmLabel="Excluir"
          onConfirm={() => { if (pendingDeleteId !== null) void doDelete(pendingDeleteId); }}
        />
      </main>
    </div>
  );
};

export default RecurrentBills;
