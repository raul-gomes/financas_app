import { useState } from 'react';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Investment, INVESTMENT_CATEGORIES } from '@/types/financial';
import { useToast } from '@/hooks/use-toast';

interface AddInvestmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (investment: Omit<Investment, 'id'>) => void;
}

export const AddInvestmentDialog = ({ open, onOpenChange, onAdd }: AddInvestmentDialogProps) => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: '',
    type: 'variavel' as 'variavel' | 'fixa',
    category: '',
    quantity: '',
    currentPrice: '',
    profit: '',
    profitPercentage: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.category || !formData.quantity || !formData.currentPrice) {
      toast({
        title: "Erro",
        description: "Preencha todos os campos obrigatórios",
        variant: "destructive"
      });
      return;
    }

    const quantity = parseFloat(formData.quantity);
    const currentPrice = parseFloat(formData.currentPrice);
    const profit = parseFloat(formData.profit) || 0;
    const profitPercentage = parseFloat(formData.profitPercentage) || 0;

    const newInvestment: Omit<Investment, 'id'> = {
      name: formData.name,
      type: formData.type,
      category: formData.category,
      quantity,
      currentPrice,
      totalValue: quantity * currentPrice,
      profit,
      profitPercentage
    };

    onAdd(newInvestment);
    
    // Reset form
    setFormData({
      name: '',
      type: 'variavel',
      category: '',
      quantity: '',
      currentPrice: '',
      profit: '',
      profitPercentage: ''
    });
    
    onOpenChange(false);
    
    toast({
      title: "Sucesso",
      description: "Investimento adicionado com sucesso!"
    });
  };

  const availableCategories = INVESTMENT_CATEGORIES[formData.type];

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title="Adicionar Investimento"
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button type="submit" form="add-investment-form">
            Adicionar
          </Button>
        </>
      }
    >
        <form id="add-investment-form" onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Investimento</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Ex: VALE3, CDB Nubank"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo</Label>
            <Select 
              value={formData.type} 
              onValueChange={(value: 'variavel' | 'fixa') => 
                setFormData(prev => ({ ...prev, type: value, category: '' }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="variavel">Renda Variável</SelectItem>
                <SelectItem value="fixa">Renda Fixa</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoria</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {availableCategories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade</Label>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                value={formData.quantity}
                onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                placeholder="100"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="currentPrice">Preço Atual</Label>
              <Input
                id="currentPrice"
                type="number"
                step="0.01"
                value={formData.currentPrice}
                onChange={(e) => setFormData(prev => ({ ...prev, currentPrice: e.target.value }))}
                placeholder="85.50"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="profit">Lucro/Prejuízo (R$)</Label>
              <Input
                id="profit"
                type="number"
                step="0.01"
                value={formData.profit}
                onChange={(e) => setFormData(prev => ({ ...prev, profit: e.target.value }))}
                placeholder="550.00"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="profitPercentage">Rendimento (%)</Label>
              <Input
                id="profitPercentage"
                type="number"
                step="0.01"
                value={formData.profitPercentage}
                onChange={(e) => setFormData(prev => ({ ...prev, profitPercentage: e.target.value }))}
                placeholder="6.87"
              />
            </div>
          </div>

        </form>
    </ResponsiveModal>
  );
};