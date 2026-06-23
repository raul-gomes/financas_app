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
import { Switch } from '@/components/ui/switch';
import { CategorySubcategories, Transaction } from '@/types/financial';
import { useToast } from '@/hooks/use-toast';
import { FinancialService } from '@/services/financialService';
import { SettingsService, UserBank } from '@/services/settingsService';

interface AddTransactionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (transaction: Transaction) => void;
}

const BANK_LOGO_CDN = 'https://cdn.jsdelivr.net/gh/wesguirra/brazil-bank-data@main/bank-logos/256/png';

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
    forma_pagamento: 'dinheiro' as string,
    total_parcelas: null as string | null,
    natureza: 'pf' as 'pf' | 'pj'
  });
  const [parcelado, setParcelado] = useState(false);
  const [bankCode, setBankCode] = useState('');
  const [banks, setBanks] = useState<UserBank[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [showNewSubcategoryInput, setShowNewSubcategoryInput] = useState(false);
  const [showNewFormaPagamentoInput, setShowNewFormaPagamentoInput] = useState(false);
  const [newFormaPagamento, setNewFormaPagamento] = useState('');
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories | null>(null)

  // Load categories
  useEffect(() => {
    FinancialService.getCategorySubcategories(formData.natureza, formData.tipo)
      .then(options => {
        setCategoryOptions(options)
      })
      .catch(err => {
        console.error('Erro ao carregar categorias:', err)
      })
  }, [formData.natureza, formData.tipo])

  // Load user's banks when dialog opens
  useEffect(() => {
    if (isOpen) {
      SettingsService.listBanks()
        .then(setBanks)
        .catch(err => console.error('Erro ao carregar bancos:', err));
    }
  }, [isOpen]);

  // Calculate parcel value
  const calcularValorParcela = () => {
    if (!parcelado || !formData.total_parcelas || !formData.valor) return null;
    const num = parseInt(formData.total_parcelas, 10);
    if (num <= 0) return null;
    return (parseFloat(formData.valor) / num).toFixed(2);
  };

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
      natureza: 'pf'
    });
    setParcelado(false);
    setBankCode('');
    setNewCategory('');
    setNewSubcategory('');
    setNewFormaPagamento('');
    setShowNewCategoryInput(false);
    setShowNewSubcategoryInput(false);
    setShowNewFormaPagamentoInput(false);
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

    // 3. Montar payload
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

    // Bank
    if (bankCode) {
      payload.bank_code = bankCode;
    }

    // Parcelas (independente do tipo de pagamento ou entrada/saída)
    if (parcelado) {
      const num = parseInt(formData.total_parcelas ?? '1', 10);
      payload.parcela = 1;
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

  const valorParcela = calcularValorParcela();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Transação</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Tipo + Natureza (inline) */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex items-center justify-between">
              <RadioGroup
                value={formData.tipo}
                onValueChange={(value) => setFormData({ ...formData, tipo: value as 'entrada' | 'saida' | 'investimento'})}
                className="flex gap-4"
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
              {/* PF/PJ Switch */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-medium ${formData.natureza === 'pf' ? 'text-foreground' : 'text-muted-foreground'}`}>PF</span>
                <Switch
                  checked={formData.natureza === 'pj'}
                  onCheckedChange={(checked) => setFormData({ ...formData, natureza: checked ? 'pj' : 'pf' })}
                />
                <span className={`text-xs font-medium ${formData.natureza === 'pj' ? 'text-foreground' : 'text-muted-foreground'}`}>PJ</span>
              </div>
            </div>
          </div>

          {/* Valor */}
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

          {/* Descrição */}
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

          {/* Categoria */}
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
                    setFormData({
                      ...formData,
                      categoria: value.trim(),
                      subcategoria: ''
                    });
                  }}
                />
              </div>
            )}
          </div>

          {/* Subcategoria */}
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

          {/* Banco */}
          <div className="space-y-2">
            <Label htmlFor="banco">Banco</Label>
            <Select
              value={bankCode}
              onValueChange={setBankCode}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um banco" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((bank) => {
                  const hasLogo = !logoErrors.has(bank.bank_code);
                  return (
                    <SelectItem key={bank.id} value={bank.bank_code}>
                      <div className="flex items-center gap-2">
                        {hasLogo ? (
                          <img
                            src={`${BANK_LOGO_CDN}/${bank.bank_code.padStart(3, '0')}.png`}
                            alt=""
                            className="w-5 h-5 rounded object-contain bg-card"
                            onError={() => setLogoErrors((prev) => new Set(prev).add(bank.bank_code))}
                          />
                        ) : (
                          <div className="w-5 h-5 rounded bg-primary/10 text-primary font-bold text-[8px] flex items-center justify-center">
                            {bank.bank_code}
                          </div>
                        )}
                        <span>{bank.bank_name}</span>
                        <span className="text-muted-foreground text-xs">({bank.bank_code})</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Forma de Pagamento + Switch Parcelado */}
          <div className="space-y-2">
            <Label htmlFor="forma_pagamento">Forma de Pagamento</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Select
                  value={showNewFormaPagamentoInput ? 'outros' : formData.forma_pagamento}
                  onValueChange={(value) => {
                    if (value === 'outros') {
                      setShowNewFormaPagamentoInput(true);
                      setFormData({ ...formData, forma_pagamento: '' });
                    } else {
                      setShowNewFormaPagamentoInput(false);
                      setNewFormaPagamento('');
                      setFormData({ ...formData, forma_pagamento: value });
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="cartão de débito">Cartão de Débito</SelectItem>
                    <SelectItem value="cartão de crédito">Cartão de Crédito</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
                {showNewFormaPagamentoInput && (
                  <div className="mt-2">
                    <Label htmlFor="newFormaPagamento">Nova Forma de Pagamento</Label>
                    <Input
                      id="newFormaPagamento"
                      placeholder="Digite a nova forma de pagamento"
                      value={newFormaPagamento}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewFormaPagamento(value);
                        setFormData({ ...formData, forma_pagamento: value.trim() });
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  id="parcelado"
                  checked={parcelado}
                  onCheckedChange={setParcelado}
                />
                <Label htmlFor="parcelado" className="text-sm font-medium cursor-pointer">Parcelado</Label>
              </div>
            </div>
          </div>

          {/* Parcelas (condicional) */}
          {parcelado && (
            <div className="border border-dashed border-primary/40 rounded-lg p-4 bg-primary/5 space-y-3">
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="total_parcelas">Total de Parcelas</Label>
                  <Input
                    id="total_parcelas"
                    type="number"
                    min="2"
                    placeholder="12"
                    value={formData.total_parcelas || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, total_parcelas: e.target.value })
                    }
                  />
                </div>
                {valorParcela && (
                  <div className="pb-1">
                    <p className="text-xs text-muted-foreground mb-0.5">Valor de cada parcela</p>
                    <p className="text-lg font-bold text-primary">R$ {valorParcela}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Data */}
          <div className="space-y-2">
            <Label htmlFor="data_transacao">Data</Label>
            <Input
              id="data_transacao"
              type="date"
              value={formData.data_transacao}
              onChange={(e) => setFormData({ ...formData, data_transacao: e.target.value })}
            />
          </div>

          {/* Ações */}
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
