import { useEffect, useState, useCallback, useRef } from 'react';
import { MetasService } from '@/services/goalsService';
import type { MetaProgresso } from '@/types/goals';
import { TrendingUp, Target, Plus, Minus, CheckCircle2, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface MetasListProps {
  sidebarOpen?: boolean;
}

export function MetasList({ sidebarOpen }: MetasListProps) {
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
    MetasService.progresso(now.getFullYear(), now.getMonth() + 1)
      .then(setMetas)
      .catch(() => setMetas([]))
      .finally(() => setLoading(false));
  }, []);

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
        subcategoria_nome: formNome.trim(),
        valor_alvo: parseFloat(formValor),
      });
      toast({ title: 'Sucesso', description: 'Meta criada!' });
      setFormNome('');
      setFormValor('');
      setShowCreate(false);
      fetchMetas();
    } catch {
      toast({ title: 'Erro', description: 'Falha ao criar meta.', variant: 'destructive' });
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
              {creating ? '...' : 'Criar'}
            </Button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {metas.length === 0 && !showCreate && (
        <div className="flex flex-col items-center justify-center py-6 text-center text-muted-foreground">
          <Target className="mb-2 h-8 w-8" />
          <p className="text-sm">Nenhuma meta definida</p>
          <Button
            variant="link"
            size="sm"
            className="mt-1 text-xs"
            onClick={() => setShowCreate(true)}
          >
            Criar primeira meta
          </Button>
        </div>
      )}

      {/* Metas list — separate active and completed */}
      {metas.length > 0 && (
        <div className="space-y-3">
          {/* Active metas */}
          {metas.some(m => !m.concluida) && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Ativas
              </p>
              <div className="space-y-2">
                {metas.filter(m => !m.concluida).map((meta) => (
                  <div
                    key={meta.subcategoria_id}
                    className="rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium">{meta.subcategoria_nome}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs text-muted-foreground hover:text-green-600"
                        onClick={async () => {
                          try {
                            await MetasService.concluir(meta.subcategoria_id);
                            fetchMetas();
                          } catch {
                            toast({ title: 'Erro', description: 'Falha ao concluir meta.', variant: 'destructive' });
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
                          meta.progresso >= 100
                            ? 'bg-green-500'
                            : meta.progresso >= 50
                              ? 'bg-emerald-400'
                              : 'bg-amber-400'
                        }`}
                        style={{ width: `${Math.min(meta.progresso, 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>R$ {meta.valor_atual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                      <span>R$ {meta.valor_alvo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed metas */}
          {metas.some(m => m.concluida) && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Concluídas
              </p>
              <div className="space-y-2">
                {metas.filter(m => m.concluida).map((meta) => (
                  <div
                    key={meta.subcategoria_id}
                    className="rounded-lg border border-green-200/50 bg-green-50/30 p-3"
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-green-700">{meta.subcategoria_nome}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-1.5 text-xs text-muted-foreground hover:text-amber-600"
                        onClick={async () => {
                          try {
                            await MetasService.reativar(meta.subcategoria_id);
                            fetchMetas();
                          } catch {
                            toast({ title: 'Erro', description: 'Falha ao reativar meta.', variant: 'destructive' });
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
                      <span>R$ {meta.valor_alvo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {meta.data_conclusao && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Concluída em {new Date(meta.data_conclusao + 'T12:00:00').toLocaleDateString('pt-BR')}
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
