import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ChipGroup, type ChipOption } from '@/components/ui/chip-group';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import { BankSearchInput } from '@/components/ui/bank-search';
import { formatCurrency } from '@/lib/format';
import { CategoryRiskBanner } from './CategoryRiskBanner';
import { BankField, CategoryField, SubcategoryField } from './TransactionSelects';
import { isKnownPaymentMethod } from './transactionFormModel';
import type { TransactionForm } from './useTransactionForm';
import type { Transaction } from '@/types/financial';

const TYPE_OPTIONS: readonly SegmentedOption<Transaction['type']>[] = [
  { value: 'expense', label: 'Saída', selectedClassName: 'text-destructive' },
  { value: 'income', label: 'Entrada', selectedClassName: 'text-success' },
  { value: 'investment', label: 'Investimento', selectedClassName: 'text-warning' },
];

type PaymentChip = (typeof PAYMENT_CHIPS)[number]['value'] | 'other';

const PAYMENT_CHIPS = [
  { value: 'cash', label: 'Dinheiro' },
  { value: 'pix', label: 'Pix' },
  { value: 'debit', label: 'Débito' },
  { value: 'credit', label: 'Crédito' },
  { value: 'transfer', label: 'Transferência' },
] as const;

const PAYMENT_OPTIONS: readonly ChipOption<PaymentChip>[] = [...PAYMENT_CHIPS, { value: 'other', label: 'Outro' }];

const ENTITY_OPTIONS: readonly ChipOption<Transaction['entity_type']>[] = [
  { value: 'individual', label: 'PF' },
  { value: 'business', label: 'PJ' },
];

interface TransactionFieldsMobileProps {
  form: TransactionForm;
}

/**
 * Form fields below `md` (bottom sheet): Saída/Entrada/Investimento segmented control, a big
 * centered amount, 48px fields, category + date side by side, and chips for the payment
 * method and PF/PJ instead of radios and a switch.
 */
export function TransactionFieldsMobile({ form }: TransactionFieldsMobileProps) {
  const { values, setValues, newPaymentMethod } = form;
  const paymentValue: PaymentChip = newPaymentMethod.active || !isKnownPaymentMethod(values.payment_method)
    ? 'other'
    : (values.payment_method as PaymentChip);

  return (
    <div className="space-y-4">
      <SegmentedControl aria-label="Tipo de transação" fill options={TYPE_OPTIONS} value={values.type} onChange={form.setType} />

      <div>
        <Label htmlFor="amount" className="sr-only">
          Valor *
        </Label>
        <CurrencyInput
          id="amount"
          placeholder="0,00"
          value={values.amount}
          onChange={(amount) => setValues({ amount })}
          required
          className="h-16 max-md:h-16 border-0 bg-transparent text-center text-3xl font-extrabold shadow-none md:text-3xl"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descrição *</Label>
        <Input
          id="description"
          placeholder="Ex.: Mercado"
          value={values.description}
          onChange={(e) => setValues({ description: e.target.value })}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <CategoryField form={form} />
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

      <SubcategoryField form={form} />

      <CategoryRiskBanner risk={form.categoryRisk} />

      <div className="space-y-2">
        <Label id="payment-chips-label">Forma de pagamento</Label>
        <ChipGroup
          aria-label="Forma de pagamento"
          options={PAYMENT_OPTIONS}
          value={paymentValue}
          onChange={(value) => {
            if (value === 'other') {
              newPaymentMethod.activate();
              setValues({ payment_method: '' });
            } else {
              newPaymentMethod.deactivate();
              setValues({ payment_method: value });
            }
          }}
        />
        {newPaymentMethod.active && (
          <Input
            id="newPaymentMethod"
            aria-label="Nova forma de pagamento"
            placeholder="Digite a forma de pagamento"
            value={newPaymentMethod.text}
            onChange={(e) => {
              newPaymentMethod.setText(e.target.value);
              setValues({ payment_method: e.target.value.trim() });
            }}
          />
        )}
      </div>

      <div className="space-y-2">
        <Label>Tipo de conta</Label>
        <ChipGroup
          aria-label="Tipo de conta"
          options={ENTITY_OPTIONS}
          value={values.entity_type}
          onChange={(entity_type) => setValues({ entity_type })}
        />
      </div>

      <BankField form={form} />
      {form.addingNewBank && (
        <div data-testid="new-bank-box" className="space-y-3 rounded-lg border border-border bg-card p-4">
          <Label className="text-sm font-semibold">Adicionar novo banco</Label>
          <BankSearchInput onBankAdded={form.onBankAdded} />
        </div>
      )}

      <div className="flex min-h-[48px] items-center justify-between gap-3">
        <Label htmlFor="isInstallment" className="flex-1 cursor-pointer text-sm font-medium">
          Parcelado
        </Label>
        <Switch id="isInstallment" checked={form.isInstallment} onCheckedChange={form.setIsInstallment} />
      </div>

      {form.isInstallment && (
        <div className="space-y-3 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4">
          <div className="space-y-2">
            <Label htmlFor="total_installments">Número de parcelas</Label>
            <Input
              id="total_installments"
              type="number"
              inputMode="numeric"
              min="2"
              placeholder="12"
              value={values.total_installments || ''}
              onChange={(e) => setValues({ total_installments: e.target.value })}
            />
          </div>
          {form.installmentAmount && (
            <p className="text-sm text-muted-foreground">
              Valor de cada parcela: <strong className="text-primary">{formatCurrency(form.installmentAmount)}</strong>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
