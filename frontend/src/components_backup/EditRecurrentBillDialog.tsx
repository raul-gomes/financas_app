import { useState, useEffect } from 'react';
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
import { ContaRecorrente, ContaRecorrenteUpdate } from '@/types/recurring_account';
import { CategorySubcategories } from '@/types/financial';
import { FinancialService } from '@/services/financialService';

interface EditRecurrentBillDialogProps {
  isOpen: boolean;
  onClose: () => void;
  conta: ContaRecorrente;
  onSubmit: (id: number, payload: ContaRecorrenteUpdate) => void;
  categoryOptions?: CategorySubcategories | null;
}

export function EditRecurrentBillDialog({
  isOpen,
  onClose,
  conta,
  onSubmit,
  categoryOptions: _categoryOptions,
}: EditRecurrentBillDialogProps) {
  const [formData, setFormData] = useState({
    descricao: conta.descricao,
    valor: conta.valor.toString(),
    dia_vencimento: conta.dia_vencimento.toString(),
    natureza: conta.natureza,
    forma_pagamento: conta.forma_pagamento,
    data_inicio: conta.data_inicio.split('T')[0],
    data_fim: conta.data_fim ? conta.data_fim.split('T')[0] : '',
    categoria: conta.categoria_nome || '',
    subcategoria: conta.subcategoria_nome || '',
  });
  const [newCategory, setNewCategory] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [showNewSubcategoryInput, setShowNewSubcategoryInput] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories | null>(null);

  // Load categories filtered by natureza + tipo='saida'
  useEffect(() => {
    FinancialService.getCategorySubcategories(formData.natureza, 'saida')
      .then(options => setCategoryOptions(options))
      .catch(() => {});
  }, [formData.natureza]);

  useEffect(() => {
    setFormData({
      descricao: conta.descricao,
      valor: conta.valor.toString(),
      dia_vencimento: conta.dia_vencimento.toString(),
      natureza: conta.natureza,
      forma_pagamento: conta.forma_pagamento,
      data_inicio: conta.data_inicio.split('T')[0],
      data_fim: conta.data_fim ? conta.data_fim.split('T')[0] : '',
      categoria: conta.categoria_nome || '',
      subcategoria: conta.subcategoria_nome || '',
    });
  }, [conta]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.descricao || !formData.valor) return;

    const payload: ContaRecorrenteUpdate = {
      descricao: formData.descricao,
      valor: parseFloat(formData.valor),
      dia_vencimento: parseInt(formData.dia_vencimento),
      natureza: formData.natureza,
      forma_pagamento: formData.forma_pagamento,
      data_inicio: formData.data_inicio,
      data_fim: formData.data_fim || undefined,
    };

    if (formData.categoria && formData.subcategoria) {
      const categoriaObj = categoryOptions?.opcoes.find(
        c => c.categoria === formData.categoria
      );
      const subObj = categoriaObj?.subcategorias.find(
        s => s.nome === formData.subcategoria
      );

      if (categoriaObj && subObj) {
        payload.categoria_id = categoriaObj.id;
        payload.subcategoria_id = subObj.id;
      } else {
        payload.categoria_nome = formData.categoria;
        payload.subcategoria_nome = formData.subcategoria;
      }
    }

    onSubmit(conta.id, payload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Conta Recorrente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="descricao">Descricao *</Label>
            <Input
              id="descricao"
              value={formData.descricao}
              onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor">Valor *</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              value={formData.valor}
              onChange={(e) => setFormData({ ...formData, valor: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="dia_vencimento">Dia de Vencimento *</Label>
            <Input
              id="dia_vencimento"
              type="number"
              min="1"
              max="31"
              value={formData.dia_vencimento}
              onChange={(e) => setFormData({ ...formData, dia_vencimento: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="natureza">Natureza</Label>
            <Select
              value={formData.natureza}
              onValueChange={(value) => setFormData({ ...formData, natureza: value as 'pf' | 'pj' })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pf">Pessoa Fisica</SelectItem>
                <SelectItem value="pj">Pessoa Juridica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
            <Select
              value={formData.forma_pagamento}
              onValueChange={(value) => setFormData({ ...formData, forma_pagamento: value })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="debito">Cartao de Debito</SelectItem>
                <SelectItem value="credito">Cartao de Credito</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_inicio">Data de Inicio *</Label>
            <Input
              id="data_inicio"
              type="date"
              value={formData.data_inicio}
              onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_fim">Data de Fim (opcional)</Label>
            <Input
              id="data_fim"
              type="date"
              value={formData.data_fim}
              onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
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
                  setNewCategory('');
                  setFormData({ ...formData, categoria: value, subcategoria: '' });
                }
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
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
                    setFormData({ ...formData, categoria: value.trim(), subcategoria: '' });
                  }}
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
                    setNewSubcategory('');
                    setFormData({ ...formData, subcategoria: value });
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione uma subcategoria" /></SelectTrigger>
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
                      setFormData({ ...formData, subcategoria: value.trim() });
                    }}
                  />
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-gradient-primary">
              Salvar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
