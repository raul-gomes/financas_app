import { useEffect, useState, useCallback } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ShoppingService } from '@/services/shoppingService';
import type { ShoppingItem } from '@/types/shopping';
import { Plus, ShoppingCart, Trash2, Search } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface ComprasListProps {
  mesRef: Date;
}

export function ComprasList({ mesRef }: ComprasListProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [newItemName, setNewItemName] = useState('');
  const [loading, setLoading] = useState(true);
  const [searchPendentes, setSearchPendentes] = useState('');
  const [searchConcluidas, setSearchConcluidas] = useState('');

  const mesRefStr = format(mesRef, 'yyyy-MM-01');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const data = await ShoppingService.listByMonth(mesRefStr);
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [mesRefStr]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAdd = async () => {
    const nome = newItemName.trim();
    if (!nome) return;
    try {
      await ShoppingService.create({ nome, mes_ref: mesRefStr });
      setNewItemName('');
      await fetchItems();
    } catch {
      toast({ title: 'Erro', description: 'Falha ao adicionar item.', variant: 'destructive' });
    }
  };

  const handleToggle = async (item: ShoppingItem) => {
    try {
      await ShoppingService.update(item.id, { marcado: !item.marcado });
      await fetchItems();
    } catch {
      toast({ title: 'Erro', description: 'Falha ao atualizar item.', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await ShoppingService.delete(id);
      await fetchItems();
    } catch {
      toast({ title: 'Erro', description: 'Falha ao excluir item.', variant: 'destructive' });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAdd();
    }
  };

  const pendentes = items.filter(i => !i.marcado);
  const concluidos = items.filter(i => i.marcado);
  const pendentesFiltrados = pendentes.filter(i =>
    i.nome.toLowerCase().includes(searchPendentes.toLowerCase())
  );
  const concluidosFiltrados = concluidos.filter(i =>
    i.nome.toLowerCase().includes(searchConcluidas.toLowerCase())
  );

  return (
    <div className="space-y-2">
      {/* Add item input */}
      <div className="flex gap-2">
        <Input
          placeholder="Adicionar item..."
          value={newItemName}
          onChange={(e) => setNewItemName(e.target.value)}
          onKeyDown={handleKeyDown}
          className="h-8 text-sm"
        />
        <Button size="sm" className="h-8 px-2" onClick={handleAdd} disabled={!newItemName.trim()}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="space-y-2 p-1">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse h-8 rounded bg-muted" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
          <ShoppingCart className="mb-2 h-8 w-8" />
          <p className="text-sm">Nenhum item na lista</p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Pendentes */}
          {pendentes.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Pendentes ({pendentes.length})
              </p>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchPendentes}
                  onChange={(e) => setSearchPendentes(e.target.value)}
                  className="h-7 pl-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                {pendentesFiltrados.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum item encontrado.</p>
                ) : (
                  pendentesFiltrados.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent/50 group"
                    >
                      <Checkbox
                        checked={item.marcado}
                        onCheckedChange={() => handleToggle(item)}
                        className="h-4 w-4"
                      />
                      <span className="flex-1 text-sm">{item.nome}</span>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Concluídos */}
          {concluidos.length > 0 && (
            <div>
              <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">
                Concluídos ({concluidos.length})
              </p>
              <div className="relative mb-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Buscar..."
                  value={searchConcluidas}
                  onChange={(e) => setSearchConcluidas(e.target.value)}
                  className="h-7 pl-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                {concluidosFiltrados.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-2">Nenhum item encontrado.</p>
                ) : (
                  concluidosFiltrados.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-green-50/50 group"
                    >
                      <Checkbox
                        checked={item.marcado}
                        onCheckedChange={() => handleToggle(item)}
                        className="h-4 w-4"
                      />
                      <div className="flex-1 min-w-0">
                        <span className="text-sm text-muted-foreground line-through">{item.nome}</span>
                        {item.data_conclusao && (
                          <p className="text-[10px] text-muted-foreground/60">
                            {new Date(item.data_conclusao + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
