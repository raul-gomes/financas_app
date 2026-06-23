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
import { Switch } from '@/components/ui/switch';
import { Transaction, CategorySubcategories } from '@/types/financial';
import { useToast } from '@/hooks/use-toast';
import { FinancialService } from '@/services/financialService';
import { SettingsService, UserBank } from '@/services/settingsService';

interface EditTransactionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onEditTransaction: (transaction: Partial<Transaction>) => void;
  transaction: Transaction;
}

const BANK_LOGO_CDN = 'https://cdn.jsdelivr.net/gh/wesguirra/brazil-bank-data@main/bank-logos/256/png';

export function EditTransactionDialog({
  isOpen,
  onClose,
  onEditTransaction,
  transaction
}: EditTransactionDialogProps) {
  const [formData, setFormData] = useState<Partial<Transaction>>({ ...transaction, data_transacao: transaction.data_transacao?.split('T')[0] || '' });
  const [parcelado, setParcelado] = useState(!!transaction.total_parcelas && transaction.total_parcelas > 1);
  const [bankCode, setBankCode] = useState(transaction.bank_code || '');
  const [banks, setBanks] = useState<UserBank[]>([]);
  const [newCategory, setNewCategory] = useState('');
  const [newSubcategory, setNewSubcategory] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [showNewSubcategoryInput, setShowNewSubcategoryInput] = useState(false);
  const [showNewFormaPagamentoInput, setShowNewFormaPagamentoInput] = useState(false);
  const [newFormaPagamento, setNewFormaPagamento] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories>({ opcoes: [] });
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());

  const KNOWN_PAYMENT_METHODS = ['dinheiro', 'pix', 'debito', 'credito', 'transferencia'];
  const { toast } = useToast();

  // Carrega categorias/subcategorias
  useEffect(() => {
    if (!isOpen) return;
    FinancialService.getCategorySubcategories(formData.natureza!, formData.tipo)
      .then(opts => {
        setCategoryOptions(opts);
        // Decide se é "Outros" para categoria
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

  // Load user's banks
  useEffect(() => {
    if (isOpen) {
      SettingsService.listBanks()
        .then(setBanks)
        .catch(err => console.error('Erro ao carregar bancos:', err));
    }
  }, [isOpen]);

  // Sync form when transaction prop changes
  useEffect(() => {
    setFormData({ ...transaction, data_transacao: transaction.data_transacao?.split('T')[0] || '' });
    setParcelado(!!transaction.total_parcelas && transaction.total_parcelas > 1);
    setBankCode(transaction.bank_code || '');

    // Check if payment method is custom (not in known list)
    const isCustom = transaction.forma_pagamento && !KNOWN_PAYMENT_METHODS.includes(transaction.forma_pagamento);
    setShowNewFormaPagamentoInput(!!isCustom);
    if (isCustom) {
      setNewFormaPagamento(transaction.forma_pagamento);
    } else {
      setNewFormaPagamento('');
    }
  }, [isOpen, transaction]);

  // Calculate parcel value
  const calcularValorParcela = () => {
    if (!parcelado || !formData.total_parcelas || !formData.valor) return null;
    const num = formData.total_parcelas;
    if (num <= 0) return null;
    return (formData.valor / num).toFixed(2);
  };

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
      (parcelado && !formData.total_parcelas)
    ) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    const payload: Partial<Transaction> = {
      ...formData,
      bank_code: bankCode || null,
    };

    // Parcelas
    if (parcelado) {
      payload.parcela = 1;
      payload.total_parcelas = formData.total_parcelas!;
    } else {
      payload.parcela = null;
      payload.total_parcelas = null;
    }

    onEditTransaction(payload);
    onClose();
    toast({ title: 'Sucesso', description: 'Transação editada com sucesso!' });
  };

  const valorParcela = calcularValorParcela();
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
          {/* Tipo + Natureza (inline) */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex items-center justify-between">
              <RadioGroup
                value={formData.tipo!}
                onValueChange={value => setFormData(prev => ({ ...prev, tipo: value as any }))}
                className="flex gap-4"
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
              {/* PF/PJ Switch */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-medium ${formData.natureza === 'pf' ? 'text-foreground' : 'text-muted-foreground'}`}>PF</span>
                <Switch
                  checked={formData.natureza === 'pj'}
                  onCheckedChange={checked =>
                    setFormData(prev => ({ ...prev, natureza: checked ? 'pj' : 'pf' }))
                  }
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
            <Label htmlFor="forma_pagamento">Forma de Pagamento *</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Select
                  value={showNewFormaPagamentoInput ? 'outros' : formData.forma_pagamento!}
                  onValueChange={value => {
                    if (value === 'outros') {
                      setShowNewFormaPagamentoInput(true);
                      setFormData(prev => ({ ...prev, forma_pagamento: '' }));
                    } else {
                      setShowNewFormaPagamentoInput(false);
                      setNewFormaPagamento('');
                      setFormData(prev => ({ ...prev, forma_pagamento: value }));
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dinheiro">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="debito">Débito</SelectItem>
                    <SelectItem value="credito">Crédito</SelectItem>
                    <SelectItem value="transferencia">Transferência</SelectItem>
                    <SelectItem value="outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
                {showNewFormaPagamentoInput && (
                  <div className="mt-2">
                    <Label>Nova Forma de Pagamento</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite a nova forma de pagamento"
                        value={newFormaPagamento}
                        onChange={e => {
                          setNewFormaPagamento(e.target.value);
                          setFormData(prev => ({ ...prev, forma_pagamento: e.target.value }));
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (newFormaPagamento.trim()) {
                            setShowNewFormaPagamentoInput(false);
                          }
                        }}
                      >
                        OK
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  id="parcelado-edit"
                  checked={parcelado}
                  onCheckedChange={setParcelado}
                />
                <Label htmlFor="parcelado-edit" className="text-sm font-medium cursor-pointer">Parcelado</Label>
              </div>
            </div>
          </div>

          {/* Parcelas (condicional) */}
          {parcelado && (
            <div className="border border-dashed border-primary/40 rounded-lg p-4 bg-primary/5 space-y-3">
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="total_parcelas">Total de Parcelas *</Label>
                  <Input
                    id="total_parcelas"
                    type="number"
                    min="2"
                    value={formData.total_parcelas!}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, total_parcelas: parseInt(e.target.value) }))
                    }
                    required
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
