import { useState } from 'react';
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
import { ContaRecorrenteCreate } from '@/types/conta_recorrente';
import { CategorySubcategories } from '@/types/financial';

interface AddRecurrentBillDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: ContaRecorrenteCreate) => void;
  categoryOptions: CategorySubcategories | null;
}

export function AddRecurrentBillDialog({
  isOpen,
  onClose,
  onSubmit,
  categoryOptions,
}: AddRecurrentBillDialogProps) {
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    dia_vencimento: '1',
    natureza: 'pf' as 'pf' | 'pj',
    forma_pagamento: 'pix',
    data_inicio: new Date().toISOString().split('T')[0],
    data_fim: '',
    categoria: '',
    subcategoria: '',
  });

  const handleClose = () => {
    setFormData({
      descricao: '',
      valor: '',
      dia_vencimento: '1',
      natureza: 'pf',
      forma_pagamento: 'pix',
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: '',
      categoria: '',
      subcategoria: '',
    });
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.descricao || !formData.valor || !formData.categoria || !formData.subcategoria) return;

    const categoriaObj = categoryOptions?.opcoes.find(
      c => c.categoria === formData.categoria
    );
    const subObj = categoriaObj?.subcategorias.find(
      s => s.nome === formData.subcategoria
    );

    if (!categoriaObj || !subObj) return;

    const payload: ContaRecorrenteCreate = {
      descricao: formData.descricao,
      valor: parseFloat(formData.valor),
      dia_vencimento: parseInt(formData.dia_vencimento),
      natureza: formData.natureza,
      forma_pagamento: formData.forma_pagamento,
      data_inicio: formData.data_inicio,
      data_fim: formData.data_fim || undefined,
      categoria_id: categoriaObj.id,
      subcategoria_id: subObj.id,
    };

    onSubmit(payload);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Conta Recorrente</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="descricao">Descricao *</Label>
            <Input
              id="descricao"
              placeholder="Ex: Aluguel, Internet, etc."
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
              placeholder="0,00"
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
              value={formData.categoria}
              onValueChange={(value) => setFormData({ ...formData, categoria: value, subcategoria: '' })}
            >
              <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
              <SelectContent>
                {categoryOptions?.opcoes.map(cat => (
                  <SelectItem key={cat.id} value={cat.categoria}>
                    {cat.categoria}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {formData.categoria && (
            <div className="space-y-2">
              <Label htmlFor="subcategoria">Subcategoria *</Label>
              <Select
                value={formData.subcategoria}
                onValueChange={(value) => setFormData({ ...formData, subcategoria: value })}
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
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button type="submit" className="flex-1 bg-gradient-primary">
              Criar
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
