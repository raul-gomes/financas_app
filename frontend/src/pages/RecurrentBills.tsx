import { useState, useEffect, useCallback } from 'react';
import { ContaRecorrente, ContaRecorrenteCreate, ContaRecorrenteUpdate } from '@/types/conta_recorrente';
import { ContaRecorrenteService } from '@/services/contaRecorrenteService';
import { FinancialService } from '@/services/financialService';
import { CategorySubcategories } from '@/types/financial';
import { Button } from '@/components/ui/button';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { AddRecurrentBillDialog } from '@/components/AddRecurrentBillDialog';
import { EditRecurrentBillDialog } from '@/components/EditRecurrentBillDialog';

const RecurrentBills = () => {
  const [contas, setContas] = useState<ContaRecorrente[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingConta, setEditingConta] = useState<ContaRecorrente | null>(null);
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

  const loadCategories = useCallback(async () => {
    try {
      const options = await FinancialService.getCategorySubcategories('all');
      setCategoryOptions(options);
    } catch (error) {
      console.error('Erro ao carregar categorias:', error);
    }
  }, []);

  useEffect(() => {
    loadContas();
    loadCategories();
  }, [loadContas, loadCategories]);

  const handleCreate = async (payload: ContaRecorrenteCreate) => {
    try {
      await ContaRecorrenteService.create(payload);
      toast({ title: 'Sucesso', description: 'Conta recorrente criada!' });
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

  const handleDelete = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta conta recorrente?')) return;
    try {
      await ContaRecorrenteService.delete(id);
      toast({ title: 'Sucesso', description: 'Conta recorrente excluida!' });
      loadContas();
    } catch {
      toast({ title: 'Erro', description: 'Falha ao excluir conta recorrente.', variant: 'destructive' });
    }
  };

  const handleToggleActive = async (conta: ContaRecorrente) => {
    try {
      await ContaRecorrenteService.update(conta.id, { ativo: !conta.ativo });
      loadContas();
    } catch {
      toast({ title: 'Erro', description: 'Falha ao alterar status.', variant: 'destructive' });
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('pt-BR');

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contas Recorrentes</h1>
            <p className="text-muted-foreground mt-1">Gerencie suas despesas mensais fixas</p>
          </div>
          <Button onClick={() => setShowAddDialog(true)} className="bg-gradient-primary">
            <Plus className="w-4 h-4 mr-2" />
            Nova Conta Recorrente
          </Button>
        </div>

        <div className="bg-card rounded-lg shadow-card border border-border overflow-hidden">
          {contas.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-muted-foreground text-lg">Nenhuma conta recorrente cadastrada.</p>
              <p className="text-muted-foreground text-sm mt-2">Clique no botão acima para adicionar.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Descricao</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Valor</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Vencimento</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Categoria</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Inicio</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                    <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Acoes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {contas.map((conta) => (
                    <tr key={conta.id} className={`hover:bg-muted/30 ${!conta.ativo ? 'opacity-50' : ''}`}>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{conta.descricao}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{formatCurrency(conta.valor)}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">Dia {conta.dia_vencimento}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {conta.categoria_nome}
                        {conta.subcategoria_nome && ` / ${conta.subcategoria_nome}`}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(conta.data_inicio)}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleToggleActive(conta)}
                          className="flex items-center gap-1 text-sm"
                        >
                          {conta.ativo ? (
                            <ToggleRight className="w-5 h-5 text-green-500" />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                          )}
                          <span className={conta.ativo ? 'text-green-500' : 'text-muted-foreground'}>
                            {conta.ativo ? 'Ativa' : 'Inativa'}
                          </span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingConta(conta);
                              setShowEditDialog(true);
                            }}
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(conta.id)}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {showAddDialog && (
          <AddRecurrentBillDialog
            isOpen={showAddDialog}
            onClose={() => setShowAddDialog(false)}
            onSubmit={handleCreate}
            categoryOptions={categoryOptions}
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
            categoryOptions={categoryOptions}
          />
        )}
      </main>
    </div>
  );
};

export default RecurrentBills;
