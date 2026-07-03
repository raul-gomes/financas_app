// src/components/EditTransactionDialog.tsx

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
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
  onEditTransaction: (transaction: Partial<Transaction>) => Promise<void>;
  transaction: Transaction;
}

const BANK_LOGO_CDN = 'https://cdn.jsdelivr.net/gh/wesguirra/brazil-bank-data@main/bank-logos/256/png';

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
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());

  const KNOWN_PAYMENT_METHODS = ['cash', 'pix', 'debit', 'credit', 'transfer'];
  const { toast } = useToast();

  // Load categories/subcategories
  useEffect(() => {
    if (!isOpen) return;
    FinancialService.getCategorySubcategories(formData.entity_type!, formData.type!)
      .then(opts => {
        setCategoryOptions(opts);
        // Decide if "Other" for category
        const existsCat = opts.options.some(c => c.name === transaction.category_name);
        setShowNewCategoryInput(!existsCat);
        if (!existsCat) setNewCategoryName(transaction.category_name);

        const subs = opts.options.find(c => c.name === transaction.category_name)?.subcategories.map(s => s.name) || [];
        const existsSub = subs.includes(transaction.subcategory_name);
        setShowNewSubcategoryInput(!existsSub);
        if (!existsSub) setNewSubcategoryName(transaction.subcategory_name);
      })
      .catch(() => {
        toast({ title: 'Error', description: 'Failed to load categories', variant: 'destructive' });
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
    return (formData.amount / num).toFixed(2);
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
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
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
      toast({ title: 'Success', description: 'Transaction edited successfully!' });
      onClose();
    } catch {
      toast({ title: 'Error', description: 'Failed to edit transaction.', variant: 'destructive' });
    }
  };

  const installmentAmount = calculateInstallmentAmount();
  const selectedSubs = categoryOptions.options
    .find(c => c.name === formData.category_name)
    ?.subcategories.map(s => s.name) || [];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type + Entity Type (inline) */}
          <div className="space-y-2">
            <Label>Type</Label>
            <div className="flex items-center justify-between">
              <RadioGroup
                value={formData.type!}
                onValueChange={value => {
                  const type = value as any;
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
                  <Label htmlFor="expense" className="text-destructive">Expense</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="income" id="income" />
                  <Label htmlFor="income" className="text-success">Income</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="investment" id="investment" />
                  <Label htmlFor="investment" className="text-warning">Investment</Label>
                </div>
              </RadioGroup>
              {/* Individual/Business Switch */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-medium ${formData.entity_type === 'individual' ? 'text-foreground' : 'text-muted-foreground'}`}>Individual</span>
                <Switch
                  checked={formData.entity_type === 'business'}
                  onCheckedChange={checked =>
                    setFormData(prev => ({ ...prev, entity_type: checked ? 'business' : 'individual' }))
                  }
                />
                <span className={`text-xs font-medium ${formData.entity_type === 'business' ? 'text-foreground' : 'text-muted-foreground'}`}>Business</span>
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount *</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              value={formData.amount!}
              onChange={e => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              value={formData.description!}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category_name">Category *</Label>

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
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.options.map(c => (
                      <SelectItem key={c.name} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {showNewCategoryInput && (
                  <div className="mt-2">
                    <Label>New Category</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="New category"
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
            <Label htmlFor="subcategory_name">Subcategory *</Label>
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
                <SelectValue placeholder="Select a subcategory" />
              </SelectTrigger>
              <SelectContent>
                {selectedSubs.map(s => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            {showNewSubcategoryInput && (
              <div className="mt-2">
                <Label>New Subcategory</Label>
                <div className="flex gap-2">
                  <Input
                    placeholder="New subcategory"
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
            <Label htmlFor="bank">Bank</Label>
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
                <SelectValue placeholder="Select a bank" />
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
                <SelectItem value="+add">
                  <div className="flex items-center gap-2 text-primary font-medium">
                    <Plus className="w-4 h-4" />
                    <span>Add new bank</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            {addingNewBank && (
              <div className="mt-2 flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Code</Label>
                  <Input
                    placeholder="Ex: 260"
                    value={newBankCode}
                    onChange={e => setNewBankCode(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">Name</Label>
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
                    toast({ title: 'Error', description: 'Please fill in bank code and name.', variant: 'destructive' });
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
                    toast({ title: 'Bank added', description: `${created.bank_name} (${created.bank_code})` });
                  } catch {
                    toast({ title: 'Error', description: 'Failed to add bank.', variant: 'destructive' });
                  }
                }}>
                  <Plus className="w-4 h-4 mr-1" /> Add
                </Button>
              </div>
            )}
          </div>

          {/* Payment Method + Installment Switch */}
          <div className="space-y-2">
            <Label htmlFor="payment_method">Payment Method *</Label>
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
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="debit">Debit</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {showNewPaymentMethodInput && (
                  <div className="mt-2">
                    <Label>New Payment Method</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Enter new payment method"
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
                <Label htmlFor="isInstallment-edit" className="text-sm font-medium cursor-pointer">Installment</Label>
              </div>
            </div>
          </div>

          {/* Installments (conditional) */}
          {isInstallment && (
            <div className="border border-dashed border-primary/40 rounded-lg p-4 bg-primary/5 space-y-3">
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="total_installments">Total Installments *</Label>
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
                    <p className="text-xs text-muted-foreground mb-0.5">Each installment value</p>
                    <p className="text-lg font-bold text-primary">R$ {installmentAmount}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="transaction_date">Date *</Label>
            <Input
              id="transaction_date"
              type="date"
              value={formData.transaction_date?.split('T')[0] || ''}
              onChange={e => setFormData(prev => ({ ...prev, transaction_date: e.target.value }))}
              required
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button type="submit">Save</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
