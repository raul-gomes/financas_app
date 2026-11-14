// src/components/EditTransactionDialog.tsx

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
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
import { BankLogo } from '@/components/ui/bank-logo';
import { formatCurrency } from '@/lib/format';

const KNOWN_PAYMENT_METHODS = ['cash', 'pix', 'debit', 'credit', 'transfer'];

interface EditTransactionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onEditTransaction: (transaction: Partial<Transaction>) => Promise<void>;
  transaction: Transaction;
}


export function EditTransactionDialog({
  isOpen,
  onClose,
  onEditTransaction,
  transaction
}: EditTransactionDialogProps) {
  const [formData, setFormData] = useState<Partial<Transaction>>({ ...transaction, transaction_date: transaction.transaction_date?.split('T')[0] || '' });
  const [isInstallment, setIsInstallment] = useState(!!transaction.total_installments && transaction.total_installments > 1);
  const [bankCode, setBankCode] = useState(transaction.bank_code || '');
  const [banks, setBanks] = useState<UserBank[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [showNewSubcategoryInput, setShowNewSubcategoryInput] = useState(false);
  const [showNewPaymentMethodInput, setShowNewPaymentMethodInput] = useState(false);
  const [newPaymentMethodName, setNewPaymentMethodName] = useState('');
  const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories>({ options: [] });
  const [addingNewBank, setAddingNewBank] = useState(false);
  const [newBankCode, setNewBankCode] = useState('');
  const [newBankName, setNewBankName] = useState('');

  const { toast } = useToast();

  // Load categories/subcategories
  useEffect(() => {
    if (!isOpen) return;
    FinancialService.getCategorySubcategories(formData.entity_type!, formData.type!)
      .then(opts => {
        setCategoryOptions(opts);
        // Decide if "Other" for category
        const categoryName = transaction.category_name ?? '';
        const subcategoryName = transaction.subcategory_name ?? '';
        const existsCat = opts.options.some(c => c.name === categoryName);
        setShowNewCategoryInput(!existsCat);
        if (!existsCat) setNewCategoryName(categoryName);

        const subs = opts.options.find(c => c.name === categoryName)?.subcategories.map(s => s.name) || [];
        const existsSub = subs.includes(subcategoryName);
        setShowNewSubcategoryInput(!existsSub);
        if (!existsSub) setNewSubcategoryName(subcategoryName);
      })
      .catch(() => {
        toast({ title: 'Erro', description: 'Falha ao carregar categorias', variant: 'destructive' });
      });
  }, [isOpen, transaction.category_name, transaction.subcategory_name, formData.entity_type, formData.type, toast]);

  // Load user's banks
  useEffect(() => {
    if (isOpen) {
      SettingsService.listBanks()
        .then(setBanks)
        .catch(err => console.error('Error loading banks:', err));
    }
  }, [isOpen]);

  // Sync form when transaction prop changes
  useEffect(() => {
    setFormData({ ...transaction, transaction_date: transaction.transaction_date?.split('T')[0] || '' });
    setIsInstallment(!!transaction.total_installments && transaction.total_installments > 1);
    setBankCode(transaction.bank_code || '');

    // Check if payment method is custom (not in known list)
    const isCustom = transaction.payment_method && !KNOWN_PAYMENT_METHODS.includes(transaction.payment_method);
    setShowNewPaymentMethodInput(!!isCustom);
    if (isCustom) {
      setNewPaymentMethodName(transaction.payment_method);
    } else {
      setNewPaymentMethodName('');
    }
  }, [isOpen, transaction]);

  // Calculate installment amount
  const calculateInstallmentAmount = () => {
    if (!isInstallment || !formData.total_installments || !formData.amount) return null;
    const num = formData.total_installments;
    if (num <= 0) return null;
    return formData.amount / num;
  };

  const handleClose = () => {
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !formData.type ||
      !formData.amount ||
      !formData.description ||
      !formData.category_name ||
      !formData.subcategory_name ||
      !formData.payment_method ||
      !formData.transaction_date ||
      (isInstallment && !formData.total_installments)
    ) {
      toast({ title: 'Erro', description: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    const payload: Partial<Transaction> = {
      ...formData,
      bank_code: bankCode || null,
    };

    // Installments
    payload.is_installment = isInstallment;
    if (isInstallment) {
      payload.installment_number = 1;
      payload.total_installments = formData.total_installments!;
    } else {
      payload.installment_number = null;
      payload.total_installments = null;
    }

    try {
      await onEditTransaction(payload);
      toast({ title: 'Sucesso', description: 'Transação editada!' });
      onClose();
    } catch {
      toast({ title: 'Erro', description: 'Falha ao editar transação.', variant: 'destructive' });
    }
  };

  const installmentAmount = calculateInstallmentAmount();
  const selectedSubs = categoryOptions.options
    .find(c => c.name === formData.category_name)
    ?.subcategories.map(s => s.name) || [];

  return (
    <ResponsiveModal
      open={isOpen}
      onOpenChange={(open) => !open && handleClose()}
      title="Editar Transação"
      footer={
        <>
          <Button type="button" variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-transaction-form">Salvar</Button>
        </>
      }
    >
        <form id="edit-transaction-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Type + Entity Type (inline) */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex items-center justify-between">
              <RadioGroup
                value={formData.type!}
                onValueChange={value => {
                  const type = value as Transaction['type'];
                  if (type === 'income' || type === 'investment') {
                    const autoCategory = type === 'income' ? 'Income' : 'Investments';
                    setFormData(prev => ({ ...prev, type, category_name: autoCategory, subcategory_name: '' }));
                  } else {
                    setFormData(prev => ({ ...prev, type }));
                  }
                }}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="expense" id="expense" />
                  <Label htmlFor="expense" className="text-destructive">Despesa</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="income" id="income" />
                  <Label htmlFor="income" className="text-success">Receita</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="investment" id="investment" />
                  <Label htmlFor="investment" className="text-warning">Investimento</Label>
                </div>
              </RadioGroup>
              {/* Individual/Business Switch */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-medium ${formData.entity_type === 'individual' ? 'text-foreground' : 'text-muted-foreground'}`}>Pessoa Física</span>
                <Switch
                  checked={formData.entity_type === 'business'}
                  onCheckedChange={checked =>
                    setFormData(prev => ({ ...prev, entity_type: checked ? 'business' : 'individual' }))
                  }
                />
                <span className={`text-xs font-medium ${formData.entity_type === 'business' ? 'text-foreground' : 'text-muted-foreground'}`}>Pessoa Jurídica</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Valor *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                value={formData.amount!}
                onChange={e => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
                required
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="transaction_date">Data *</Label>
              <Input
                id="transaction_date"
                type="date"
                value={formData.transaction_date?.split('T')[0] || ''}
                onChange={e => setFormData(prev => ({ ...prev, transaction_date: e.target.value }))}
                required
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Input
              id="description"
              value={formData.description!}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category_name">Categoria *</Label>

            {/* When income/investment: disabled input with fixed value */}
            {formData.type === 'income' || formData.type === 'investment' ? (
              <Input
                id="category_name"
                value={formData.category_name || ''}
                disabled
                className="bg-muted cursor-not-allowed"
              />
            ) : (
              <>
                <Select
                  value={showNewCategoryInput ? 'other' : formData.category_name!}
                  onValueChange={value => {
                    if (value === 'other') {
                      setShowNewCategoryInput(true);
                      setFormData(prev => ({ ...prev, category_name: '', subcategory_name: '' }));
                    } else {
                      setShowNewCategoryInput(false);
                      setNewCategoryName('');
                      setFormData(prev => ({ ...prev, category_name: value, subcategory_name: '' }));
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.options.map(c => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Outros</SelectItem>
                  </SelectContent>
                </Select>
                {showNewCategoryInput && (
                  <div className="mt-2">
                    <Label>Nova categoria</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Nova categoria"
                        value={newCategoryName}
                        onChange={e => {
                          setNewCategoryName(e.target.value);
                          setFormData(prev => ({ ...prev, category_name: e.target.value }));
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (newCategoryName.trim()) {
                            setShowNewCategoryInput(false);
                          }
                        }}
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Subcategory */}
          <div className="space-y-2">
            <Label htmlFor="subcategory_name">Subcategoria *</Label>
            <Select
              value={showNewSubcategoryInput ? 'other' : formData.subcategory_name!}
              onValueChange={value => {
                if (value === 'other') {
                  setShowNewSubcategoryInput(true);
                  setFormData(prev => ({ ...prev, subcategory_name: '' }));
                } else {
                  setShowNewSubcategoryInput(false);
                  setNewSubcategoryName('');
                  setFormData(prev => ({ ...prev, subcategory_name: value }));
                }
              }}
              disabled={!formData.category_name}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione uma subcategoria" />
              </SelectTrigger>
              <SelectContent>
                {selectedSubs.map(s => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
                <SelectItem value="other">Outros</SelectItem>
              </SelectContent>
            </Select>
            {showNewSubcategoryInput && (
              <div className="mt-2">
                <Label>Nova subcategoria</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="Nova subcategoria"
                    value={newSubcategoryName}
                    onChange={e => {
                      setNewSubcategoryName(e.target.value);
                      setFormData(prev => ({ ...prev, subcategory_name: e.target.value }));
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (newSubcategoryName.trim()) {
                        setShowNewSubcategoryInput(false);
                      }
                    }}
                  >
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Bank */}
          <div className="space-y-2">
            <Label htmlFor="bank">Banco</Label>
            <Select
              value={addingNewBank ? '+add' : bankCode}
              onValueChange={(value) => {
                if (value === '+add') {
                  setAddingNewBank(true);
                  setNewBankCode('');
                  setNewBankName('');
                } else {
                  setAddingNewBank(false);
                  setBankCode(value);
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um banco" />
              </SelectTrigger>
              <SelectContent>
                {banks.map((bank) => {
                  return (
                    <SelectItem key={bank.id} value={bank.bank_code}>
                      <div className="flex items-center gap-2">
                        <BankLogo code={bank.bank_code} size="sm" />
                        <span>{bank.bank_name}</span>
                        <span className="text-muted-foreground text-xs">({bank.bank_code})</span>
                      </div>
                    </SelectItem>
                  );
                })}
                <SelectItem value="+add">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <Plus className="w-4 h-4" />
                    <span>Adicionar novo banco</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {addingNewBank && (
              <div className="mt-2 flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Código</Label>
                  <Input
                    placeholder="Ex: 260"
                    value={newBankCode}
                    onChange={e => setNewBankCode(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Nome</Label>
                  <Input
                    placeholder="Ex: Nubank"
                    value={newBankName}
                    onChange={e => setNewBankName(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <Button size="sm" variant="outline" onClick={() => setAddingNewBank(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={async () => {
                  if (!newBankCode.trim() || !newBankName.trim()) {
                    toast({ title: 'Erro', description: 'Preencha código e nome do banco.', variant: 'destructive' });
                    return;
                  }
                  try {
                    const created = await SettingsService.addBank({
                      bank_code: newBankCode.trim(),
                      bank_name: newBankName.trim(),
                    });
                    setBanks(prev => [...prev, created]);
                    setBankCode(created.bank_code);
                    setAddingNewBank(false);
                    toast({ title: 'Banco adicionado', description: `${created.bank_name} (${created.bank_code})` });
                  } catch {
                    toast({ title: 'Erro', description: 'Falha ao adicionar banco.', variant: 'destructive' });
                  }
                }}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            )}
          </div>

          {/* Payment Method + Installment Switch */}
          <div className="space-y-2">
            <Label htmlFor="payment_method">Forma de pagamento</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Select
                  value={showNewPaymentMethodInput ? 'other' : formData.payment_method!}
                  onValueChange={value => {
                    if (value === 'other') {
                      setShowNewPaymentMethodInput(true);
                      setFormData(prev => ({ ...prev, payment_method: '' }));
                    } else {
                      setShowNewPaymentMethodInput(false);
                      setNewPaymentMethodName('');
                      setFormData(prev => ({ ...prev, payment_method: value }));
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="debit">Débito</SelectItem>
                    <SelectItem value="credit">Crédito</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                    <SelectItem value="other">Outros</SelectItem>
                  </SelectContent>
                </Select>
                {showNewPaymentMethodInput && (
                  <div className="mt-2">
                    <Label>Nova forma de pagamento</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Digite a nova forma de pagamento"
                        value={newPaymentMethodName}
                        onChange={e => {
                          setNewPaymentMethodName(e.target.value);
                          setFormData(prev => ({ ...prev, payment_method: e.target.value }));
                        }}
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (newPaymentMethodName.trim()) {
                            setShowNewPaymentMethodInput(false);
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
                  id="isInstallment-edit"
                  checked={isInstallment}
                  onCheckedChange={setIsInstallment}
                />
                <Label htmlFor="isInstallment-edit" className="text-sm font-medium cursor-pointer">Parcelado</Label>
              </div>
            </div>
          </div>

          {/* Installments (conditional) */}
          {isInstallment && (
            <div className="border border-dashed border-primary/40 rounded-lg p-4 bg-primary/5 space-y-3">
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="total_installments">Número de parcelas</Label>
                  <Input
                    id="total_installments"
                    type="number"
                    min="2"
                    value={formData.total_installments!}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, total_installments: parseInt(e.target.value) }))
                    }
                    required
                  />
                </div>
                {installmentAmount && (
                  <div className="pb-1">
                    <p className="text-xs text-muted-foreground mb-0.5">Valor de cada parcela</p>
                    <p className="text-lg font-bold text-primary">{formatCurrency(installmentAmount)}</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </form>
    </ResponsiveModal>
  );
}
