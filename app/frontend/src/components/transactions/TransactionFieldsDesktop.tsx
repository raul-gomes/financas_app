import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { BankSearchInput } from '@/components/ui/bank-search';
import { formatCurrency } from '@/lib/format';
import { CategoryRiskBanner } from './CategoryRiskBanner';
import { BankField, CategoryField, SubcategoryField } from './TransactionSelects';
import { isKnownPaymentMethod } from './transactionFormModel';
import type { TransactionForm } from './useTransactionForm';
import type { Transaction } from '@/types/financial';

interface TransactionFieldsDesktopProps {
  form: TransactionForm;
}

/**
 * Form fields at `md` and above (the layout the dialogs always had): type radios with the
 * PF/PJ switch, amount + date, description, category + subcategory, bank, payment method,
 * installments. Shared by the create and edit dialogs.
 */
export function TransactionFieldsDesktop({ form }: TransactionFieldsDesktopProps) {
  const { values, setValues, newPaymentMethod } = form;
  const paymentValue = newPaymentMethod.active ? 'other' : isKnownPaymentMethod(values.payment_method) ? values.payment_method : 'other';

  return (
    <>
      {/* Type + Entity Type (inline) */}
      <div className="space-y-2">
        <Label>Tipo</Label>
        <div className="flex items-center justify-between">
          <RadioGroup
            value={values.type}
            onValueChange={(value) => form.setType(value as Transaction['type'])}
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
          <div className="flex items-center gap-2 shrink-0">
            <span className={`text-xs font-medium ${values.entity_type === 'individual' ? 'text-foreground' : 'text-muted-foreground'}`}>PF</span>
            <Switch
              aria-label="Pessoa jurídica"
              checked={values.entity_type === 'business'}
              onCheckedChange={(checked) => setValues({ entity_type: checked ? 'business' : 'individual' })}
            />
            <span className={`text-xs font-medium ${values.entity_type === 'business' ? 'text-foreground' : 'text-muted-foreground'}`}>PJ</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="amount">Valor *</Label>
          <CurrencyInput id="amount" placeholder="0,00" value={values.amount} onChange={(amount) => setValues({ amount })} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="transaction_date">Data</Label>
          <Input
            id="transaction_date"
            type="text"
            inputMode="numeric"
            placeholder="dd/mm/aaaa"
            value={form.dateInput}
            onChange={(e) => form.onDateInputChange(e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição *</Label>
        <Input
          id="description"
          placeholder="Ex: Mercado, Salário, etc."
          value={values.description}
          onChange={(e) => setValues({ description: e.target.value })}
          required
        />
      </div>

      {/* Category + Subcategory */}
      <div className="grid gap-4 sm:grid-cols-2">
        <CategoryField form={form} />
        <SubcategoryField form={form} />
      </div>

      <CategoryRiskBanner risk={form.categoryRisk} />

      {/* Bank + Payment Method */}
      <div className="grid gap-4 sm:grid-cols-2">
        <BankField form={form} />

        <div className="space-y-2">
          <Label htmlFor="payment_method">Forma de pagamento</Label>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <Select
                value={paymentValue}
                onValueChange={(value) => {
                  if (value === 'other') {
                    newPaymentMethod.activate();
                    setValues({ payment_method: '' });
                  } else {
                    newPaymentMethod.deactivate();
                    setValues({ payment_method: value });
                  }
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Dinheiro</SelectItem>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="debit">Cartão de Débito</SelectItem>
                  <SelectItem value="credit">Cartão de Crédito</SelectItem>
                  <SelectItem value="transfer">Transferência</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
              {newPaymentMethod.active && (
                <div className="mt-2">
                  <Label htmlFor="newPaymentMethod">Nova forma de pagamento</Label>
                  <Input
                    id="newPaymentMethod"
                    placeholder="Digite a nova forma de pagamento"
                    value={newPaymentMethod.text}
                    onChange={(e) => {
                      newPaymentMethod.setText(e.target.value);
                      setValues({ payment_method: e.target.value.trim() });
                    }}
                  />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch id="isInstallment" checked={form.isInstallment} onCheckedChange={form.setIsInstallment} />
              <Label htmlFor="isInstallment" className="text-sm font-medium cursor-pointer">Parcelado</Label>
            </div>
          </div>
        </div>
      </div>

      {/* Add new bank (full row) */}
      {form.addingNewBank && (
        <div data-testid="new-bank-box" className="rounded-lg border border-border bg-card p-4 space-y-3 sm:col-span-2">
          <Label className="text-sm font-semibold">Adicionar novo banco</Label>
          <BankSearchInput onBankAdded={form.onBankAdded} />
        </div>
      )}

      {/* Installments (conditional) */}
      {form.isInstallment && (
        <div className="border border-dashed border-primary/40 rounded-lg p-4 bg-primary/5 space-y-3">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="total_installments">Número de parcelas</Label>
              <Input
                id="total_installments"
                type="number"
                min="2"
                placeholder="12"
                value={values.total_installments || ''}
                onChange={(e) => setValues({ total_installments: e.target.value })}
              />
            </div>
            {form.installmentAmount && (
              <div className="pb-1">
                <p className="text-xs text-muted-foreground mb-0.5">Valor de cada parcela</p>
                <p className="text-lg font-bold text-primary">{formatCurrency(form.installmentAmount)}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
