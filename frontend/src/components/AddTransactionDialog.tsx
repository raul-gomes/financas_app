import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { CategorySubcategories, Transaction } from '@/types/financial';
import { useToast } from '@/hooks/use-toast';
import { FinancialService } from '@/services/financialService';

interface AddTransactionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (transaction: Transaction) => void;
}

export function AddTransactionDialog({
  isOpen,
  onClose,
  onAddTransaction
}: AddTransactionDialogProps) {
  const [formData, setFormData] = useState({
    tipo: 'saida' as 'saida' | 'entrada' | 'investimento',
    valor: '',
    descricao: '',
    categoria: '',
    subcategoria: '',
    data_transacao: new Date().toISOString().split('T')[0],
    forma_pagamento: 'dinheiro' as 'credito' | 'debito' | 'pix' | 'transferencia' | 'dinheiro',
    total_parcelas: null as string | null,
    parcela: null as string | null,
    natureza: 'pf' as 'pf' | 'pj'
  });
  const [newCategory, setNewCategory] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [showNewSubcategoryInput, setShowNewSubcategoryInput] = useState(false);
  const { toast } = useToast();

  const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories | null>(null)

  useEffect(() => {
    FinancialService.getCategorySubcategories(formData.natureza)
      .then(options => {
        setCategoryOptions(options)
      })
      .catch(err => {
        console.error('Erro ao carregar categorias:', err)
      })
  }, [formData.natureza])

  // Reseta tudo ao fechar
  const handleClose = () => {
    setFormData({
      tipo: 'saida',
      valor: '',
      descricao: '',
      categoria: '',
      subcategoria: '',
      data_transacao: new Date().toISOString().split('T')[0],
      forma_pagamento: 'dinheiro',
      total_parcelas: null,
      parcela: null,
      natureza: 'pf'
    });
    setNewCategory('');
    setNewSubcategory('');
    setShowNewCategoryInput(false);
    setShowNewSubcategoryInput(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.valor || !formData.descricao || !formData.categoria || !formData.subcategoria) {
      toast({
        title: 'Erro',
        description: 'Por favor, preencha todos os campos obrigatórios.',
        variant: 'destructive'
      });
      return;
    }

    // 1. Encontrar objeto CategoriaOpcao
    const categoriaObj = categoryOptions?.opcoes.find(
      c => c.categoria === formData.categoria
    );
    // 2. Encontrar SubcategoriaOpcao
    const subObj = categoriaObj?.subcategorias.find(
      s => s.nome === formData.subcategoria
    );


    // 3. Montar payload seguindo as regras
    const payload: any = {
      tipo: formData.tipo,
      valor: parseFloat(formData.valor),
      descricao: formData.descricao,
      data_transacao: new Date(formData.data_transacao + 'T00:00:00').toISOString(),
      forma_pagamento: formData.forma_pagamento === 'cartão de crédito' ? 'credito' :
                       formData.forma_pagamento === 'cartão de débito' ? 'debito' :
                       formData.forma_pagamento,
      natureza: formData.natureza,
    };

    // só adiciona parcelas se for crédito
    if (payload.forma_pagamento === 'credito') {
      const num = parseInt(formData.total_parcelas ?? '1', 10);
      payload.parcela = 1; // Primeira parcela
      payload.total_parcelas = num;
    }

    if (categoriaObj && subObj) {
      payload.categoria_id = categoriaObj.id;
      payload.subcategoria_id = subObj.id;
    } else {
      payload.categoria_nome = formData.categoria;
      payload.subcategoria_nome = formData.subcategoria;
    }

    try {
      await FinancialService.addTransaction(payload);
      toast({ title: 'Transação adicionada', description: 'Sucesso!' });
      handleClose();
      window.location.reload();
    } catch {
      toast({ title: 'Erro', description: 'Falha ao criar transação.', variant: 'destructive' });
    }

  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Transação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <RadioGroup
              value={formData.tipo}
              onValueChange={(value) => setFormData({ ...formData, tipo: value as 'entrada' | 'saida' | 'investimento'})}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="saida" id="saida" />
                <Label htmlFor="saida" className="text-destructive font-medium">Saída</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="entrada" id="entrada" />
                <Label htmlFor="entrada" className="text-success font-medium">Entrada</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="investimento" id="investimento" />
                <Label htmlFor="investimento" className="text-warning font-medium">Investimento</Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="natureza"
                checked={formData.natureza === 'pj'}
                onCheckedChange={(checked) => setFormData({ ...formData, natureza: checked ? 'pj' : 'pf' })}
              />
              <Label htmlFor="natureza">Pessoa Jurídica</Label>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor">Valor *</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={formData.valor}
              onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="descricao">Descrição *</Label>
            <Input
              id="descricao"
              placeholder="Ex: Supermercado, Salário, etc."
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria *</Label>
            <Select
              value={showNewCategoryInput ? 'outros' : formData.categoria}
              onValueChange={(value) => {
                if (value === 'outros') {
                  setShowNewCategoryInput(true);
                  setFormData({ ...formData, categoria: '', subcategoria: '' });
                } else {
                  setShowNewCategoryInput(false);
                  setNewCategory(''); // Limpa o campo quando muda para categoria existente
                  setFormData({ ...formData, categoria: value, subcategoria: '' });
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma categoria" />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions?.opcoes.map(cat => (
                  <SelectItem key={cat.id} value={cat.categoria}>
                    {cat.categoria}
                  </SelectItem>
                ))}
                <SelectItem value="outros">Outros</SelectItem>
              </SelectContent>
            </Select>

            {showNewCategoryInput && (
              <div className="space-y-2 mt-2">
                <Label htmlFor="newCategory">Nova Categoria</Label>
                <Input
                  id="newCategory"
                  placeholder="Digite a nova categoria"
                  value={newCategory}
                  onChange={(e) => {
                    const value = e.target.value;
                    setNewCategory(value);
                    // Atualiza o formData em tempo real
                    setFormData({
                      ...formData,
                      categoria: value.trim(),
                      subcategoria: ''
                    });
                  }}
                // Removido o onBlur que estava causando o problema
                />
              </div>
            )}
          </div>


          {formData.categoria && (
            <div className="space-y-2">
              <Label htmlFor="subcategoria">Subcategoria *</Label>
              <Select
                value={showNewSubcategoryInput ? 'outros' : formData.subcategoria}
                onValueChange={(value) => {
                  if (value === 'outros') {
                    setShowNewSubcategoryInput(true);
                    setFormData({ ...formData, subcategoria: '' });
                  } else {
                    setShowNewSubcategoryInput(false);
                    setNewSubcategory(''); // Limpa o campo quando muda para subcategoria existente
                    setFormData({ ...formData, subcategoria: value });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma subcategoria" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions?.opcoes
                    .find(cat => cat.categoria === formData.categoria)
                    ?.subcategorias.map(sub => (
                      <SelectItem key={sub.id} value={sub.nome}>
                        {sub.nome}
                      </SelectItem>
                    ))}
                  <SelectItem value="outros">Outros</SelectItem>
                </SelectContent>

              </Select>

              {showNewSubcategoryInput && (
                <div className="space-y-2 mt-2">
                  <Label htmlFor="newSubcategory">Nova Subcategoria</Label>
                  <Input
                    id="newSubcategory"
                    placeholder="Digite a nova subcategoria"
                    value={newSubcategory}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewSubcategory(value);
                      // Atualiza o formData em tempo real
                      setFormData({
                        ...formData,
                        subcategoria: value.trim()
                      });
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
            <Select
              value={formData.forma_pagamento}
              onValueChange={(value) =>
                setFormData({ ...formData, forma_pagamento: value as any })
              }
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="cartão de débito">Cartão de Débito</SelectItem>
                <SelectItem value="cartão de crédito">Cartão de Crédito</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(formData.forma_pagamento === 'cartão de crédito' || formData.forma_pagamento === 'credito') && (
            <div className="space-y-2">
              <Label htmlFor="total_parcelas">Total de Parcelas</Label>
              <Input
                id="total_parcelas"
                type="number"
                min="1"
                value={formData.total_parcelas || ''}
                onChange={(e) =>
                  setFormData({ ...formData, total_parcelas: e.target.value })
                }
              />
            </div>
          )}



          <div className="space-y-2">
            <Label htmlFor="data_transacao">Data</Label>
            <Input
              id="data_transacao"
              type="date"
              value={formData.data_transacao}
              onChange={(e) => setFormData({ ...formData, data_transacao: e.target.value })}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-gradient-primary">
              Adicionar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}