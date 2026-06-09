// src/components/EditTransactionDialog.tsx

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Transaction, CategorySubcategories } from '@/types/financial';
import { useToast } from '@/hooks/use-toast';
import { FinancialService } from '@/services/financialService';

interface EditTransactionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onEditTransaction: (transaction: Partial<Transaction>) => void;
  transaction: Transaction;
}

export function EditTransactionDialog({
  isOpen,
  onClose,
  onEditTransaction,
  transaction
}: EditTransactionDialogProps) {
  const [formData, setFormData] = useState<Partial<Transaction>>(transaction);
  const [newCategory, setNewCategory] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [showNewSubcategoryInput, setShowNewSubcategoryInput] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories>({ opcoes: [] });
  const { toast } = useToast();

  // Carrega categorias/subcategorias
  useEffect(() => {
    if (!isOpen) return;
    FinancialService.getCategorySubcategories(formData.natureza!, formData.tipo)
      .then(opts => {
        setCategoryOptions(opts);
        // Agora que opts estão carregadas, decida se é “Outros”:
        const existsCat = opts.opcoes.some(c => c.categoria === transaction.categoria_nome);
        setShowNewCategoryInput(!existsCat);
        if (!existsCat) setNewCategory(transaction.categoria_nome);

        const subs = opts.opcoes.find(c => c.categoria === transaction.categoria_nome)?.subcategorias.map(s => s.nome) || [];
        const existsSub = subs.includes(transaction.subcategoria_nome);
        setShowNewSubcategoryInput(!existsSub);
        if (!existsSub) setNewSubcategory(transaction.subcategoria_nome);
      })
      .catch(() => {
        toast({ title: 'Erro', description: 'Falha ao carregar categorias', variant: 'destructive' });
      });
  }, [isOpen, transaction.categoria_nome, transaction.subcategoria_nome, formData.natureza, formData.tipo, toast]);

  useEffect(() => {
    setFormData(transaction);
    // Não faça aqui nenhum teste de categoryOptions!
  }, [isOpen, transaction]);

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.tipo ||
      !formData.valor ||
      !formData.descricao ||
      !formData.categoria_nome ||
      !formData.subcategoria_nome ||
      !formData.forma_pagamento ||
      !formData.data_transacao ||
      (formData.forma_pagamento === 'credito' && !formData.total_parcelas)
    ) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }
    onEditTransaction(formData);
    onClose();
    toast({ title: 'Sucesso', description: 'Transação editada com sucesso!' });
  };

  const selectedSubs = categoryOptions.opcoes
    .find(c => c.categoria === formData.categoria_nome)
    ?.subcategorias.map(s => s.nome) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Transação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <RadioGroup
              value={formData.tipo!}
              onValueChange={value => setFormData(prev => ({ ...prev, tipo: value as any }))}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="saida" id="saida" />
                <Label htmlFor="saida" className="text-destructive">Saída</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="entrada" id="entrada" />
                <Label htmlFor="entrada" className="text-success">Entrada</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="investimento" id="investimento" />
                <Label htmlFor="investimento" className="text-warning">Investimento</Label>
              </div>
            </RadioGroup>
          </div>

          {/* Natureza */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="natureza"
                checked={formData.natureza === 'pj'}
                onCheckedChange={checked =>
                  setFormData(prev => ({ ...prev, natureza: checked ? 'pj' : 'pf' }))
                }
              />
              <Label htmlFor="natureza">Pessoa Jurídica</Label>
            </div>
          </div>

          {/* Valor */}
          <div className="space-y-2">
            <Label htmlFor="valor">Valor *</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              value={formData.valor!}
              onChange={e => setFormData(prev => ({ ...prev, valor: parseFloat(e.target.value) }))}
              required
            />
          </div>

          {/* Descrição */}
          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              value={formData.descricao!}
              onChange={e => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
              required
            />
          </div>

          {/* Categoria */}
          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria *</Label>
            <Select
              value={showNewCategoryInput ? 'outros' : formData.categoria_nome!}
              onValueChange={value => {
                if (value === 'outros') {
                  setShowNewCategoryInput(true);
                  setFormData(prev => ({ ...prev, categoria_nome: '', subcategoria_nome: '' }));
                } else {
                  setShowNewCategoryInput(false);
                  setNewCategory('');
                  setFormData(prev => ({ ...prev, categoria_nome: value, subcategoria_nome: '' }));
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.opcoes.map(c => (
                  <SelectItem key={c.categoria} value={c.categoria}>
                    {c.categoria}
                  </SelectItem>
                ))}
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>
            {showNewCategoryInput && (
              <div className="mt-2">
                <Label>Nova Categoria</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nova categoria"
                    value={newCategory}
                    onChange={e => {
                      setNewCategory(e.target.value);
                      setFormData(prev => ({ ...prev, categoria_nome: e.target.value }));
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (newCategory.trim()) {
                        setShowNewCategoryInput(false);
                      }
                    }}
                  >
                    Adicionar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Subcategoria */}
          <div className="space-y-2">
            <Label htmlFor="subcategoria">Subcategoria *</Label>
            <Select
              value={showNewSubcategoryInput ? 'outros' : formData.subcategoria_nome!}
              onValueChange={value => {
                if (value === 'outros') {
                  setShowNewSubcategoryInput(true);
                  setFormData(prev => ({ ...prev, subcategoria_nome: '' }));
                } else {
                  setShowNewSubcategoryInput(false);
                  setNewSubcategory('');
                  setFormData(prev => ({ ...prev, subcategoria_nome: value }));
                }
              }}
              disabled={!formData.categoria_nome}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a subcategoria" />
              </SelectTrigger>
              <SelectContent>
                {selectedSubs.map(s => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>
            {showNewSubcategoryInput && (
              <div className="mt-2">
                <Label>Nova Subcategoria</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nova subcategoria"
                    value={newSubcategory}
                    onChange={e => {
                      setNewSubcategory(e.target.value);
                      setFormData(prev => ({ ...prev, subcategoria_nome: e.target.value }));
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (newSubcategory.trim()) {
                        setShowNewSubcategoryInput(false);
                      }
                    }}
                  >
                    Adicionar
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Forma de Pagamento */}
          <div className="space-y-2">
            <Label htmlFor="forma_pagamento">Forma de Pagamento *</Label>
            <Select
              value={formData.forma_pagamento!}
              onValueChange={value => setFormData(prev => ({ ...prev, forma_pagamento: value as any }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="debito">Débito</SelectItem>
                <SelectItem value="credito">Crédito</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Parcelas */}
          {formData.forma_pagamento === 'credito' && (
            <div className="space-y-2">
              <Label htmlFor="total_parcelas">Total de Parcelas *</Label>
              <Input
                id="total_parcelas"
                type="number"
                min="1"
                value={formData.total_parcelas!}
                onChange={e =>
                  setFormData(prev => ({ ...prev, total_parcelas: parseInt(e.target.value) }))
                }
                required
              />
            </div>
          )}

          {/* Data */}
          <div className="space-y-2">
            <Label htmlFor="data_transacao">Data *</Label>
            <Input
              id="data_transacao"
              type="date"
              value={formData.data_transacao?.split('T')[0] || ''}
              onChange={e => setFormData(prev => ({ ...prev, data_transacao: e.target.value }))}
              required
            />
          </div>

          {/* Ações */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button type="submit">Salvar</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
