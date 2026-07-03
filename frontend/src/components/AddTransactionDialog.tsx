import { useCallback, useEffect, useState } from 'react';
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
import { CategorySubcategories, Transaction, DuplicateInfo } from '@/types/financial';
import { useToast } from '@/hooks/use-toast';
import { FinancialService } from '@/services/financialService';
import { SettingsService, UserBank } from '@/services/settingsService';
import { Plus } from 'lucide-react';
import { DuplicateDialog, DialogAction } from '@/components/DuplicateDialog';

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
  const [newBankCode, setNewBankCode] = useState('');
  const [newBankName, setNewBankName] = useState('');
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Duplicate checking state
  const [duplicateConflict, setDuplicateConflict] = useState<{
    existing: DuplicateInfo
    payload: any
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
    onClose();
  };

  const buildPayload = useCallback(() => {
    const catObj = categoryOptions?.options.find(
      c => c.name === formData.category_name
    );
    const subObj = catObj?.subcategories.find(
      s => s.name === formData.subcategory_name
    );

    const payload: any = {
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

  const executeAdd = async (payload: any) => {
    try {
      await FinancialService.addTransaction(payload);
      toast({ title: 'Transaction added', description: 'Success!' });
      handleClose();
      onAddTransaction(payload as unknown as Transaction);
    } catch {
      toast({ title: 'Error', description: 'Failed to create transaction.', variant: 'destructive' });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.amount || !formData.description || !formData.category_name || !formData.subcategory_name) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields.',
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
        toast({ title: 'Error', description: 'Failed to replace transaction.', variant: 'destructive' });
      }
      setDuplicateConflict(null);
    } else if (action === 'edit') {
      // Close duplicate dialog, keep form open so user can edit
      setDuplicateConflict(null);
    }
  };

  const installmentAmount = calculateInstallmentAmount();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Type + Entity Type (inline) */}
          <div className="space-y-2">
            <Label>Type</Label>
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
                  <Label htmlFor="expense" className="text-destructive font-medium">Expense</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="income" id="income" />
                  <Label htmlFor="income" className="text-success font-medium">Income</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="investment" id="investment" />
                  <Label htmlFor="investment" className="text-warning font-medium">Investment</Label>
                </div>
              </RadioGroup>
              {/* Individual/Business Switch */}
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-medium ${formData.entity_type === 'individual' ? 'text-foreground' : 'text-muted-foreground'}`}>Individual</span>
                <Switch
                  checked={formData.entity_type === 'business'}
                  onCheckedChange={(checked) => setFormData({ ...formData, entity_type: checked ? 'business' : 'individual' })}
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
              placeholder="0.00"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description *</Label>
            <Input
              id="description"
              placeholder="Ex: Supermarket, Salary, etc."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              required
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category_name">Category *</Label>

            {/* When income/investment: disabled input with fixed value (category might not exist in DB yet) */}
            {formData.type === 'income' || formData.type === 'investment' ? (
              <Input
                id="category_name"
                value={formData.category_name}
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
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions?.options.map(cat => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>

                {showNewCategoryInput && (
                  <div className="space-y-2 mt-2">
                    <Label htmlFor="newCategory">New Category</Label>
                    <Input
                      id="newCategory"
                      placeholder="Enter new category"
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

          {/* Subcategory */}
          {formData.category_name && (
            <div className="space-y-2">
              <Label htmlFor="subcategory_name">Subcategory *</Label>
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
                  <SelectValue placeholder="Select a subcategory" />
                </SelectTrigger>
                <SelectContent>
                  {categoryOptions?.options
                    .find(cat => cat.name === formData.category_name)
                    ?.subcategories.map(sub => (
                      <SelectItem key={sub.id} value={sub.name}>
                        {sub.name}
                      </SelectItem>
                    ))}
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>

              {showNewSubcategoryInput && (
                <div className="space-y-2 mt-2">
                  <Label htmlFor="newSubcategory">New Subcategory</Label>
                  <Input
                    id="newSubcategory"
                    placeholder="Enter new subcategory"
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
            <Label htmlFor="payment_method">Payment Method</Label>
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
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="pix">PIX</SelectItem>
                    <SelectItem value="debit card">Debit Card</SelectItem>
                    <SelectItem value="credit card">Credit Card</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {showNewPaymentMethodInput && (
                  <div className="mt-2">
                    <Label htmlFor="newPaymentMethod">New Payment Method</Label>
                    <Input
                      id="newPaymentMethod"
                      placeholder="Enter new payment method"
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
                <Label htmlFor="isInstallment" className="text-sm font-medium cursor-pointer">Installment</Label>
              </div>
            </div>
          </div>

          {/* Installments (conditional) */}
          {isInstallment && (
            <div className="border border-dashed border-primary/40 rounded-lg p-4 bg-primary/5 space-y-3">
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label htmlFor="total_installments">Total Installments</Label>
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
                    <p className="text-xs text-muted-foreground mb-0.5">Each installment value</p>
                    <p className="text-lg font-bold text-primary">R$ {installmentAmount}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Date */}
          <div className="space-y-2">
            <Label htmlFor="transaction_date">Date</Label>
            <Input
              id="transaction_date"
              type="date"
              value={formData.transaction_date}
              onChange={(e) => setFormData({ ...formData, transaction_date: e.target.value })}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={handleClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" className="flex-1 bg-gradient-primary" disabled={isCheckingDuplicate}>
              {isCheckingDuplicate ? 'Checking...' : 'Add'}
            </Button>
          </div>
        </form>
      </DialogContent>

      {/* Duplicate Dialog */}
      {duplicateConflict && (
        <DuplicateDialog
          open={!!duplicateConflict}
          conflicts={[{
            index: 0,
            existing: duplicateConflict.existing,
            newData: {
              description: duplicateConflict.payload.description,
              amount: duplicateConflict.payload.amount,
              transaction_date: duplicateConflict.payload.transaction_date,
            },
          }]}
          onResolve={(_action) => handleDuplicateAction(_action)}
          onClose={() => setDuplicateConflict(null)}
        />
      )}
    </Dialog>
  );
}
