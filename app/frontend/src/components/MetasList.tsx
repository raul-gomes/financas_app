import { useEffect, useState, useCallback, useRef } from 'react';
import { MetasService } from '@/services/goalsService';
import type { MetaProgresso } from '@/types/goals';
import { TrendingUp, Target, Plus, Minus, CheckCircle2, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useToast } from '@/hooks/use-toast';

interface MetasListProps {
  sidebarOpen?: boolean;
  entityType?: string;
}

export function MetasList({ sidebarOpen, entityType }: MetasListProps) {
  const { toast } = useToast();
  const [metas, setMetas] = useState<MetaProgresso[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [formNome, setFormNome] = useState('');
  const [formValor, setFormValor] = useState('');
  const [creating, setCreating] = useState(false);
  const lastOpenRef = useRef(false);

  const fetchMetas = useCallback(() => {
    setLoading(true);
    const now = new Date();
    const entityTypeParam = !entityType || entityType === 'all' ? undefined : (entityType === 'pf' ? 'individual' : 'business');
    MetasService.progresso(now.getFullYear(), now.getMonth() + 1, undefined, entityTypeParam)
      .then(setMetas)
      .catch(() => setMetas([]))
      .finally(() => setLoading(false));
  }, [entityType]);

  // Fetch on mount and when sidebar opens
  useEffect(() => {
    fetchMetas();
  }, [fetchMetas]);

  // Refetch when sidebar transitions from closed to open
  useEffect(() => {
    if (sidebarOpen && !lastOpenRef.current) {
      fetchMetas();
    }
    lastOpenRef.current = !!sidebarOpen;
  }, [sidebarOpen, fetchMetas]);

  const handleCreate = async () => {
    if (!formNome.trim() || !formValor) return;
    setCreating(true);
    try {
      await MetasService.create({
        subcategory_name: formNome.trim(),
        target_amount: parseFloat(formValor),
      });
      toast({ title: 'Success', description: 'Meta criada!' });
      setFormNome('');
      setFormValor('');
      setShowCreate(false);
      fetchMetas();
    } catch {
      toast({ title: 'Error', description: 'Failed to create goal.', variant: 'destructive' });
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleCreate();
  };

  if (loading) {
    return (
      <div className="space-y-3 p-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse space-y-2 rounded-lg border p-3">
            <div className="h-4 w-3/4 rounded bg-muted" />
            <div className="h-2 w-full rounded bg-muted" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Header + toggle create button */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {metas.length > 0 ? `Metas (${metas.length})` : 'Metas'}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-muted-foreground hover:text-foreground"
          onClick={() => setShowCreate(!showCreate)}
        >
          {showCreate ? <Minus className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          <span className="ml-1 text-xs">{showCreate ? 'Fechar' : 'Nova'}</span>
        </Button>
      </div>

      {/* Inline create form */}
      {showCreate && (
        <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
          <Input
            placeholder="Nome da meta"
            value={formNome}
            onChange={(e) => setFormNome(e.target.value)}
            onKeyDown={handleKeyDown}
            className="h-8 text-sm"
          />
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              step="0.01"
              placeholder="Valor alvo (R$)"
              value={formValor}
              onChange={(e) => setFormValor(e.target.value)}
              onKeyDown={handleKeyDown}
              className="h-8 text-sm flex-1"
            />
            <Button
              size="sm"
              className="h-8"
              onClick={handleCreate}
              disabled={!formNome.trim() || !formValor || creating}
            >
              {creating ? '...' : 'Create'}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {metas.length === 0 && !showCreate && (
        <EmptyState icon={Target} title="Nenhuma meta definida">
          <Button
            variant="link"
            size="sm"
            className="mt-1 text-xs"
            onClick={() => setShowCreate(true)}
          >
            Create primeira meta
          </Button>
        </EmptyState>
      )}

      {/* Metas list — separate active and completed */}
      {metas.length > 0 && (
        <div className="space-y-3">
          {/* Active metas */}
          {metas.some(m => !m.completed) && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Ativas
              </p>
              <div className="space-y-2">
                {metas.filter(m => !m.completed).map((meta) => (
                  <div
                    key={meta.subcategory_id}
                    className="rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium">{meta.subcategory_name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs text-muted-foreground hover:text-green-600"
                        onClick={async () => {
                          try {
                            await MetasService.concluir(meta.subcategory_id);
                            fetchMetas();
                          } catch {
                            toast({ title: 'Error', description: 'Falha ao concluir meta.', variant: 'destructive' });
                          }
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        Concluir
                      </Button>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className={`h-full rounded-full transition-all ${
                          meta.progress >= 100
                            ? 'bg-green-500'
                            : meta.progress >= 50
                              ? 'bg-emerald-400'
                              : 'bg-amber-400'
                        }`}
                        style={{ width: `${Math.min(meta.progress, 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>R$ {meta.current_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                      <span>R$ {meta.target_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed metas */}
          {metas.some(m => m.completed) && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Concluídas
              </p>
              <div className="space-y-2">
                {metas.filter(m => m.completed).map((meta) => (
                  <div
                    key={meta.subcategory_id}
                    className="rounded-lg border border-green-200/50 bg-green-50/30 p-3"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-green-700">{meta.subcategory_name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs text-muted-foreground hover:text-amber-600"
                        onClick={async () => {
                          try {
                            await MetasService.reativar(meta.subcategory_id);
                            fetchMetas();
                          } catch {
                            toast({ title: 'Error', description: 'Falha ao reativar meta.', variant: 'destructive' });
                          }
                        }}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Reativar
                      </Button>
                    </div>
                    <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full w-full rounded-full bg-green-500" />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span className="text-green-600">Completa</span>
                      <span>R$ {meta.target_amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {meta.completed_at && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Concluída em {new Date(meta.completed_at + 'T12:00:00').toLocaleDateString('en-US')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
