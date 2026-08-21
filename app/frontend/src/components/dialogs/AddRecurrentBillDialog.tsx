import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ContaRecorrenteCreate } from '@/types/recurringAccount';
import { CategorySubcategories } from '@/types/financial';
import { FinancialService } from '@/services/financialService';

interface AddRecurrentBillDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: ContaRecorrenteCreate) => void;
  categoryOptions?: CategorySubcategories | null;
}

export function AddRecurrentBillDialog({
  isOpen,
  onClose,
  onSubmit,
  categoryOptions: _categoryOptions,
}: AddRecurrentBillDialogProps) {
  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    due_day: '1',
    entity_type: 'individual' as 'individual' | 'business',
    payment_method: 'pix',
    start_date: new Date().toISOString().split('T')[0],
    end_date: '',
    category_name: '',
    subcategory_name: '',
  });
  const [newCategory, setNewCategory] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [showNewSubcategoryInput, setShowNewSubcategoryInput] = useState(false);
  const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories | null>(null);

  // Load categories filtered by natureza + tipo='expense' (recorrente é sempre saída)
  useEffect(() => {
    FinancialService.getCategorySubcategories(formData.entity_type, 'expense')
      .then(options => setCategoryOptions(options))
      .catch(() => {});
  }, [formData.entity_type]);

  const handleClose = () => {
    setFormData({
      description: '',
      amount: '',
      due_day: '1',
      entity_type: 'individual',
      payment_method: 'pix',
      start_date: new Date().toISOString().split('T')[0],
      end_date: '',
      category_name: '',
      subcategory_name: '',
    });
    setNewCategory('');
    setNewSubcategory('');
    setShowNewCategoryInput(false);
    setShowNewSubcategoryInput(false);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.description || !formData.amount || !formData.category_name || !formData.subcategory_name) return;

    const categoriaObj = categoryOptions?.options.find(
      c => c.name === formData.category_name
    );
    const subObj = categoriaObj?.subcategories.find(
      s => s.name === formData.subcategory_name
    );

    const payload: ContaRecorrenteCreate = {
      description: formData.description,
      amount: parseFloat(formData.amount),
      due_day: parseInt(formData.due_day),
      entity_type: formData.entity_type,
      payment_method: formData.payment_method,
      start_date: formData.start_date,
      end_date: formData.end_date || undefined,
    };

    if (categoriaObj && subObj) {
      payload.category_id = categoriaObj.id;
      payload.subcategory_id = subObj.id;
    } else {
      payload.category_name = formData.category_name;
      payload.subcategory_name = formData.subcategory_name;
    }

    onSubmit(payload);
  };

  return (
    <ResponsiveModal
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      title="Nova Conta Recorrente"
      footer={
        <>
          <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
            Cancelar
          </Button>
          <Button type="submit" form="add-recurrent-bill-form" className="flex-1 bg-gradient-primary">
            Criar
          </Button>
        </>
      }
    >
        <form id="add-recurrent-bill-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="descricao">Descricao *</Label>
            <Input
              id="descricao"
              placeholder="Ex: Aluguel, Internet, etc."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="valor">Valor *</Label>
            <Input
              id="valor"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
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
              value={formData.due_day}
              onChange={(e) => setFormData({ ...formData, due_day: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="natureza">Natureza</Label>
            <Select
              value={formData.entity_type}
              onValueChange={(value) => setFormData({ ...formData, entity_type: value as 'individual' | 'business' })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="individual">Pessoa Fisica</SelectItem>
                <SelectItem value="business">Pessoa Juridica</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
            <Select
              value={formData.payment_method}
              onValueChange={(value) => setFormData({ ...formData, payment_method: value })}
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
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="data_fim">Data de Fim (opcional)</Label>
            <Input
              id="data_fim"
              type="date"
              value={formData.end_date}
              onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="categoria">Categoria *</Label>
            <Select
              value={showNewCategoryInput ? 'outros' : formData.category_name}
              onValueChange={(value) => {
                if (value === 'outros') {
                  setShowNewCategoryInput(true);
                  setFormData({ ...formData, category_name: '', subcategory_name: '' });
                } else {
                  setShowNewCategoryInput(false);
                  setNewCategory('');
                  setFormData({ ...formData, category_name: value, subcategory_name: '' });
                }
              }}
            >
              <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
              <SelectContent>
                {categoryOptions?.options.map(cat => (
                  <SelectItem key={cat.id} value={cat.name}>
                    {cat.name}
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
                    setFormData({ ...formData, category_name: value.trim(), subcategory_name: '' });
                  }}
                />
              </div>
            )}
          </div>

          {formData.category_name && (
            <div className="space-y-2">
              <Label htmlFor="subcategoria">Subcategoria *</Label>
              <Select
                value={showNewSubcategoryInput ? 'outros' : formData.subcategory_name}
                onValueChange={(value) => {
                  if (value === 'outros') {
                    setShowNewSubcategoryInput(true);
                    setFormData({ ...formData, subcategory_name: '' });
                  } else {
                    setShowNewSubcategoryInput(false);
                    setNewSubcategory('');
                    setFormData({ ...formData, subcategory_name: value });
                  }
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione uma subcategoria" /></SelectTrigger>
                <SelectContent>
                  {categoryOptions?.options
                    .find(cat => cat.name === formData.category_name)
                    ?.subcategories.map(sub => (
                      <SelectItem key={sub.id} value={sub.name}>
                        {sub.name}
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
                      setFormData({ ...formData, subcategory_name: value.trim() });
                    }}
                  />
                </div>
              )}
            </div>
          )}

        </form>
    </ResponsiveModal>
  );
}
