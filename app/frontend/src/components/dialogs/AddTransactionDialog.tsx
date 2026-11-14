import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ResponsiveModal } from '@/components/ui/responsive-modal';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
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
import { CategorySubcategories, Transaction, DuplicateInfo, TransactionCreatePayload } from '@/types/financial';
import { useToast } from '@/hooks/use-toast';
import { FinancialService } from '@/services/financialService';
import { SettingsService, UserBank } from '@/services/settingsService';
import { NotificationService } from '@/services/notificationService';
import { CategoryRiskResponse } from '@/types/notifications';
import { formatCurrency } from '@/lib/format';
import { Plus, AlertTriangle } from 'lucide-react';
import { DuplicateDialog, DialogAction } from '@/components/dialogs/DuplicateDialog';
import { BankLogo, BankLogoFallback } from '@/components/ui/bank-logo';
import { BankSearchInput } from '@/components/ui/bank-search';

interface AddTransactionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTransaction: (transaction: Transaction) => void;
}

const maskDateBR = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
};

const brToIso = (br: string): string => {
  const m = br.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return '';
  const iso = `${m[3]}-${m[2]}-${m[1]}`;
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? '' : iso;
};

const isoToBr = (iso: string): string => {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
};

// Nomes exibidos para as categorias automáticas (internamente seguem o padrão do backend)
const CATEGORY_LABELS: Record<string, string> = {
  Income: 'Receita',
  Investments: 'Investimentos',
};


export function AddTransactionDialog({
  isOpen,
  onClose,
  onAddTransaction
}: AddTransactionDialogProps) {
  const [formData, setFormData] = useState({
    type: 'expense' as 'expense' | 'income' | 'investment',
    amount: '',
    description: '',
    category_name: '',
    subcategory_name: '',
    transaction_date: new Date().toISOString().split('T')[0],
    payment_method: 'cash' as string,
    total_installments: null as string | null,
    entity_type: 'individual' as 'individual' | 'business'
  });
  const [isInstallment, setIsInstallment] = useState(false);
  const [bankCode, setBankCode] = useState('');
  const [banks, setBanks] = useState<UserBank[]>([]);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
  const [showNewSubcategoryInput, setShowNewSubcategoryInput] = useState(false);
  const [showNewPaymentMethodInput, setShowNewPaymentMethodInput] = useState(false);
  const [newPaymentMethodName, setNewPaymentMethodName] = useState('');
  const [addingNewBank, setAddingNewBank] = useState(false);
  const [dateInput, setDateInput] = useState(() => isoToBr(new Date().toISOString().split('T')[0]));
  const [categoryRisk, setCategoryRisk] = useState<CategoryRiskResponse | null>(null);
  const { toast } = useToast();

  // Duplicate checking state
  const [duplicateConflict, setDuplicateConflict] = useState<{
    existing: DuplicateInfo
    payload: TransactionCreatePayload
    newData: { description: string; amount: number; transaction_date: string }
  } | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);

  const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories | null>(null)

  // Load categories
  useEffect(() => {
    FinancialService.getCategorySubcategories(formData.entity_type, formData.type)
      .then(options => {
        setCategoryOptions(options)
      })
      .catch(err => {
        console.error('Error loading categories:', err)
      })
  }, [formData.entity_type, formData.type])

  // Load user's banks when dialog opens
  useEffect(() => {
    if (isOpen) {
      SettingsService.listBanks()
        .then(setBanks)
        .catch(err => console.error('Error loading banks:', err));
    }
  }, [isOpen]);

  // Aviso não-bloqueante: projeção de limite (gasto atual + valor digitado)
  useEffect(() => {
    if (formData.type !== 'expense') {
      setCategoryRisk(null);
      return;
    }
    const catObj = categoryOptions?.options.find(
      c => c.name === formData.category_name
    );
    if (!catObj) {
      setCategoryRisk(null);
      return;
    }
    let cancelled = false;
    const amount = parseFloat(formData.amount) || 0;
    NotificationService.checkCategoryRisk(catObj.id, amount)
      .then(risk => {
        if (!cancelled) setCategoryRisk(risk);
      })
      .catch(() => {
        // falha silenciosa — o aviso é bônus, não deve quebrar o fluxo
      });
    return () => { cancelled = true; };
  }, [formData.category_name, formData.entity_type, formData.type, formData.amount, categoryOptions]);

  // Calculate installment amount
  const calculateInstallmentAmount = () => {
    if (!isInstallment || !formData.total_installments || !formData.amount) return null;
    const num = parseInt(formData.total_installments, 10);
    if (num <= 0) return null;
    return (parseFloat(formData.amount) / num).toFixed(2);
  };

  // Reset form on close
  const handleClose = () => {
    setFormData({
      type: 'expense',
      amount: '',
      description: '',
      category_name: '',
      subcategory_name: '',
      transaction_date: new Date().toISOString().split('T')[0],
      payment_method: 'cash',
      total_installments: null,
      entity_type: 'individual'
    });
    setIsInstallment(false);
    setBankCode('');
    setNewCategoryName('');
    setNewSubcategoryName('');
    setNewPaymentMethodName('');
    setShowNewCategoryInput(false);
    setShowNewSubcategoryInput(false);
    setShowNewPaymentMethodInput(false);
    setCategoryRisk(null);
    setDateInput(isoToBr(new Date().toISOString().split('T')[0]));
    onClose();
  };

  const buildPayload = useCallback(() => {
    const catObj = categoryOptions?.options.find(
      c => c.name === formData.category_name
    );
    const subObj = catObj?.subcategories.find(
      s => s.name === formData.subcategory_name
    );

    const payload: TransactionCreatePayload = {
      type: formData.type,
      amount: parseFloat(formData.amount),
      description: formData.description,
      transaction_date: formData.transaction_date,
      payment_method: formData.payment_method === 'credit card' ? 'credit' :
                      formData.payment_method === 'debit card' ? 'debit' :
                      formData.payment_method,
      entity_type: formData.entity_type,
    };

    if (bankCode) payload.bank_code = bankCode;
    payload.is_installment = isInstallment;
    if (isInstallment) {
      const num = parseInt(formData.total_installments ?? '1', 10);
      payload.installment_number = 1;
      payload.total_installments = num;
    }
    if (catObj && subObj) {
      payload.category_id = catObj.id;
      payload.subcategory_id = subObj.id;
    } else {
      payload.category_name = formData.category_name;
      payload.subcategory_name = formData.subcategory_name;
    }
    return payload;
  }, [formData, bankCode, isInstallment, categoryOptions]);

  const executeAdd = async (payload: TransactionCreatePayload) => {
    try {
      await FinancialService.addTransaction(payload);
      toast({ title: 'Transação adicionada', description: 'Sucesso!' });
      handleClose();
      onAddTransaction(payload as unknown as Transaction);
    } catch {
      toast({ title: 'Erro', description: 'Falha ao criar transação.', variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.amount || !formData.description || !formData.category_name || !formData.subcategory_name) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.transaction_date) {
      toast({
        title: 'Erro',
        description: 'Informe uma data válida.',
        variant: 'destructive'
      });
      return;
    }

    const payload = buildPayload();

    // Check for duplicates before creating
    setIsCheckingDuplicate(true);
    try {
      const checkResult = await FinancialService.checkDuplicates({
        transaction_date: formData.transaction_date,
        amount: parseFloat(formData.amount),
      });

      if (checkResult.results[0]?.has_duplicate) {
        setDuplicateConflict({
          existing: checkResult.results[0].duplicates[0],
          payload,
          newData: {
            description: formData.description,
            amount: parseFloat(formData.amount),
            transaction_date: formData.transaction_date,
          },
        });
        return;
      }
    } catch {
      // If check fails, proceed anyway
    } finally {
      setIsCheckingDuplicate(false);
    }

    await executeAdd(payload);
  };

  const handleDuplicateAction = async (action: DialogAction) => {
    if (!duplicateConflict) return;

    if (action === 'keep') {
      // Skip — do nothing
      setDuplicateConflict(null);
      handleClose();
    } else if (action === 'replace') {
      // Delete existing, then add new
      try {
        await FinancialService.deleteTransaction(duplicateConflict.existing.id);
        await executeAdd(duplicateConflict.payload);
      } catch {
        toast({ title: 'Erro', description: 'Falha ao substituir transação.', variant: 'destructive' });
      }
      setDuplicateConflict(null);
    } else if (action === 'edit') {
      // Close duplicate dialog, keep form open so user can edit
      setDuplicateConflict(null);
    }
  };

  const installmentAmount = calculateInstallmentAmount();

  return (
    <>
      <ResponsiveModal
        open={isOpen}
        onOpenChange={(open) => !open && handleClose()}
        title="Nova Transação"
        footer={
          <>
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancelar
            </Button>
            <Button
              type="submit"
              form="add-transaction-form"
              className="flex-1 bg-gradient-primary"
              disabled={isCheckingDuplicate}
            >
              {isCheckingDuplicate ? 'Verificando...' : 'Adicionar'}
            </Button>
          </>
        }
      >
        <form id="add-transaction-form" onSubmit={handleSubmit} className="space-y-4">
          {/* Type + Entity Type (inline) */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex items-center justify-between">
              <RadioGroup
                value={formData.type}
                onValueChange={(value) => {
                  const type = value as 'income' | 'expense' | 'investment';
                  if (type === 'income' || type === 'investment') {
                    const autoCategoria = type === 'income' ? 'Income' : 'Investments';
                    setFormData({ ...formData, type, category_name: autoCategoria, subcategory_name: '' });
                  } else {
                    setFormData({ ...formData, type });
                  }
                }}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="expense" id="expense" />
                  <Label htmlFor="expense" className="text-destructive font-medium">Despesa</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="income" id="income" />
                  <Label htmlFor="income" className="text-success font-medium">Receita</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="investment" id="investment" />
                  <Label htmlFor="investment" className="text-warning font-medium">Investimento</Label>
                </div>
              </RadioGroup>
              {/* Individual/Business Switch */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-medium ${formData.entity_type === 'individual' ? 'text-foreground' : 'text-muted-foreground'}`}>PF</span>
                <Switch
                  checked={formData.entity_type === 'business'}
                  onCheckedChange={(checked) => setFormData({ ...formData, entity_type: checked ? 'business' : 'individual' })}
                />
                <span className={`text-xs font-medium ${formData.entity_type === 'business' ? 'text-foreground' : 'text-muted-foreground'}`}>PJ</span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">Valor *</Label>
              <CurrencyInput
                id="amount"
                placeholder="0,00"
                value={formData.amount}
                onChange={(amount) => setFormData({ ...formData, amount })}
                required
              />
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="transaction_date">Data</Label>
              <Input
                id="transaction_date"
                type="text"
                inputMode="numeric"
                placeholder="dd/mm/aaaa"
                value={dateInput}
                onChange={(e) => {
                  const masked = maskDateBR(e.target.value);
                  setDateInput(masked);
                  setFormData({ ...formData, transaction_date: brToIso(masked) });
                }}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição *</Label>
            <Input
              id="description"
              placeholder="Ex: Mercado, Salário, etc."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          {/* Category + Subcategory */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category_name">Categoria *</Label>

            {/* When income/investment: disabled input with fixed value (category might not exist in DB yet) */}
            {formData.type === 'income' || formData.type === 'investment' ? (
              <Input
                id="category_name"
                value={CATEGORY_LABELS[formData.category_name] ?? formData.category_name}
                disabled
                className="bg-muted cursor-not-allowed"
              />
            ) : (
              <>
                <Select
                  value={showNewCategoryInput ? 'other' : formData.category_name}
                  onValueChange={(value) => {
                    if (value === 'other') {
                      setShowNewCategoryInput(true);
                      setFormData({ ...formData, category_name: '', subcategory_name: '' });
                    } else {
                      setShowNewCategoryInput(false);
                      setNewCategoryName('');
                      setFormData({ ...formData, category_name: value, subcategory_name: '' });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions?.options.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Outra</SelectItem>
                  </SelectContent>
                </Select>

                {showNewCategoryInput && (
                  <div className="space-y-2 mt-2">
                    <Label htmlFor="newCategory">Nova categoria</Label>
                    <Input
                      id="newCategory"
                      placeholder="Digite a nova categoria"
                      value={newCategoryName}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewCategoryName(value);
                        setFormData({
                          ...formData,
                          category_name: value.trim(),
                          subcategory_name: ''
                        });
                      }}
                    />
                  </div>
                )}
              </>
            )}
            </div>

            {formData.category_name && (
              <div className="space-y-2">
              <Label htmlFor="subcategory_name">Subcategoria *</Label>
              <Select
                value={showNewSubcategoryInput ? 'other' : formData.subcategory_name}
                onValueChange={(value) => {
                  if (value === 'other') {
                    setShowNewSubcategoryInput(true);
                    setFormData({ ...formData, subcategory_name: '' });
                  } else {
                    setShowNewSubcategoryInput(false);
                    setNewSubcategoryName('');
                    setFormData({ ...formData, subcategory_name: value });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma subcategoria" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions?.options
                    .find(cat => cat.name === formData.category_name)
                    ?.subcategories.map(sub => (
                      <SelectItem key={sub.id} value={sub.name}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  <SelectItem value="other">Outra</SelectItem>
                </SelectContent>
              </Select>

              {showNewSubcategoryInput && (
                <div className="space-y-2 mt-2">
                  <Label htmlFor="newSubcategory">Nova subcategoria</Label>
                  <Input
                    id="newSubcategory"
                    placeholder="Digite a nova subcategoria"
                    value={newSubcategoryName}
                    onChange={(e) => {
                      const value = e.target.value;
                      setNewSubcategoryName(value);
                      setFormData({
                        ...formData,
                        subcategory_name: value.trim()
                      });
                    }}
                  />
                </div>
              )}
              </div>
            )}
          </div>

          {/* Aviso não-bloqueante: projeção de limite com cores por threshold */}
          {categoryRisk && categoryRisk.limit > 0 && (
            (() => {
              const severity = categoryRisk.severity ?? (categoryRisk.is_over_limit ? 'destructive' : null);
              if (!severity) return null;
              const bannerStyles = {
                warning: 'border-warning/30 bg-warning/15 text-warning',
                critical: 'border-critical/30 bg-critical/15 text-critical',
                destructive: 'border-destructive/40 bg-destructive/10 text-destructive',
              }[severity];
              return (
                <div
                  role="alert"
                  data-testid="category-risk-banner"
                  data-severity={severity}
                  className={`flex items-start gap-2 rounded-lg border p-3 ${bannerStyles}`}
                >
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="text-sm space-y-1">
                    <p className="font-medium">
                      {categoryRisk.is_over_limit
                        ? `Adicionar estourará o limite de "${categoryRisk.category_name}"`
                        : `Atenção no limite de "${categoryRisk.category_name}"`}
                    </p>
                    <p className="text-xs opacity-90">
                      Gasto atual {formatCurrency(categoryRisk.spent)} + {formatCurrency(categoryRisk.amount)} = {formatCurrency(categoryRisk.projected_spent)} → {categoryRisk.projected_percent_used.toFixed(0)}% do limite{categoryRisk.is_over_limit ? '. Segure a mão!' : ''}
                    </p>
                  </div>
                </div>
              );
            })()
          )}

          {/* Bank + Payment Method */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="bank">Banco</Label>
            <Select
              value={addingNewBank ? '+add' : bankCode}
              onValueChange={(value) => {
                if (value === '+add') {
                  setAddingNewBank(true);
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
                {banks.map((bank, idx) => {
                  return (
                    <SelectItem key={bank.id} value={bank.bank_code}>
                      <div className="flex items-center gap-2">
                        <BankLogo
                          code={bank.bank_code}
                          size="sm"
                          alt={bank.bank_name}
                          fallback={<BankLogoFallback name={bank.bank_name} index={idx} size="sm" />}
                        />
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
            </div>

            {/* Payment Method + Installment Switch */}
            <div className="space-y-2">
            <Label htmlFor="payment_method">Forma de pagamento</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Select
                  value={showNewPaymentMethodInput ? 'other' : formData.payment_method}
                  onValueChange={(value) => {
                    if (value === 'other') {
                      setShowNewPaymentMethodInput(true);
                      setFormData({ ...formData, payment_method: '' });
                    } else {
                      setShowNewPaymentMethodInput(false);
                      setNewPaymentMethodName('');
                      setFormData({ ...formData, payment_method: value });
                    }
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Dinheiro</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="debit card">Cartão de Débito</SelectItem>
                    <SelectItem value="credit card">Cartão de Crédito</SelectItem>
                    <SelectItem value="transfer">Transferência</SelectItem>
                    <SelectItem value="other">Outro</SelectItem>
                  </SelectContent>
                </Select>
                {showNewPaymentMethodInput && (
                  <div className="mt-2">
                    <Label htmlFor="newPaymentMethod">Nova forma de pagamento</Label>
                    <Input
                      id="newPaymentMethod"
                      placeholder="Digite a nova forma de pagamento"
                      value={newPaymentMethodName}
                      onChange={(e) => {
                        const value = e.target.value;
                        setNewPaymentMethodName(value);
                        setFormData({ ...formData, payment_method: value.trim() });
                      }}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch
                  id="isInstallment"
                  checked={isInstallment}
                  onCheckedChange={setIsInstallment}
                />
                <Label htmlFor="isInstallment" className="text-sm font-medium cursor-pointer">Parcelado</Label>
              </div>
            </div>
            </div>
          </div>

          {/* Add new bank (full row) */}
          {addingNewBank && (
            <div data-testid="new-bank-box" className="rounded-lg border border-border bg-card p-4 space-y-3 sm:col-span-2">
              <Label className="text-sm font-semibold">Adicionar novo banco</Label>
              <BankSearchInput
                onBankAdded={(bank) => {
                  setBanks((prev) => [...prev, bank]);
                  setBankCode(bank.bank_code);
                  setAddingNewBank(false);
                }}
              />
            </div>
          )}

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
                    placeholder="12"
                    value={formData.total_installments || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, total_installments: e.target.value })
                    }
                  />
                </div>
                {installmentAmount && (
                  <div className="pb-1">
                    <p className="text-xs text-muted-foreground mb-0.5">Valor de cada parcela</p>
                    <p className="text-lg font-bold text-primary">R$ {installmentAmount}</p>
                  </div>
                )}
              </div>
            </div>
          )}

        </form>
      </ResponsiveModal>

      {/* Duplicate Dialog */}
      {duplicateConflict && (
        <DuplicateDialog
          open={!!duplicateConflict}
          conflicts={[{
            index: 0,
            existing: duplicateConflict.existing,
            newData: duplicateConflict.newData,
          }]}
          onResolve={(_action) => handleDuplicateAction(_action)}
          onClose={() => setDuplicateConflict(null)}
        />
      )}
    </>
  );
}
