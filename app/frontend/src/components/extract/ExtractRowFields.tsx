import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { DEFAULT_INSTALLMENTS, MIN_INSTALLMENTS, OTHER_OPTION, type RowDraft } from '@/lib/extractReview';
import type { ParsedTransaction } from '@/types/extract';
import type { CategorySubcategories } from '@/types/financial';
import type { RowActions } from './useExtractReview';

/** Payment methods offered by the review selects (value, pt-BR label). */
const PAYMENT_METHODS = [
  ['dinheiro', 'Dinheiro'],
  ['pix', 'PIX'],
  ['debito', 'Débito'],
  ['credito', 'Crédito'],
  ['transferencia', 'Transferência'],
  ['boleto', 'Boleto'],
] as const;

/** `compact` is the dense desktop table; `touch` is the phone card (44px controls). */
export type FieldSize = 'compact' | 'touch';

const TRIGGER_CLASS: Record<FieldSize, string> = {
  compact: 'h-7 text-xs',
  touch: 'h-11 text-sm',
};
const INPUT_CLASS: Record<FieldSize, string> = {
  compact: 'h-7 text-xs mt-1',
  touch: 'h-11 text-sm mt-2',
};
const SWITCH_CLASS: Record<FieldSize, string> = {
  compact: 'scale-75',
  touch: '',
};

interface FieldProps {
  transaction: ParsedTransaction;
  draft: RowDraft;
  actions: RowActions;
  size: FieldSize;
}

/** Installments switch plus the total input when it is on. */
export function InstallmentsField({ draft, actions, size }: Omit<FieldProps, 'transaction'>) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={draft.installment}
        onCheckedChange={actions.onInstallmentToggle}
        className={SWITCH_CLASS[size]}
        aria-label="Parcelado"
      />
      {draft.installment && (
        <Input
          type="number"
          min={MIN_INSTALLMENTS}
          value={draft.totalInstallments || DEFAULT_INSTALLMENTS}
          onChange={(e) => actions.onTotalInstallmentsChange(e.target.value)}
          className={size === 'compact' ? 'h-7 w-14 text-xs' : 'h-11 w-20 text-sm'}
          aria-label="Número de parcelas"
        />
      )}
    </div>
  );
}

/** Payment method select with a free-text input for "Outros...". */
export function PaymentMethodField({ transaction, draft, actions, size }: FieldProps) {
  return (
    <>
      <Select
        value={draft.customPaymentMethod ? OTHER_OPTION : transaction.payment_method}
        onValueChange={actions.onPaymentMethodChange}
      >
        <SelectTrigger className={TRIGGER_CLASS[size]}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {PAYMENT_METHODS.map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
          <SelectItem value={OTHER_OPTION}>Outros...</SelectItem>
        </SelectContent>
      </Select>
      {draft.customPaymentMethod && (
        <Input
          placeholder="Nova forma de pagamento"
          value={draft.paymentMethodName}
          onChange={(e) => actions.onPaymentMethodNameChange(e.target.value)}
          className={INPUT_CLASS[size]}
        />
      )}
    </>
  );
}

/** PF/PJ switch. */
export function EntityTypeField({ transaction, actions, size }: Omit<FieldProps, 'draft'>) {
  const isBusiness = transaction.entity_type === 'business';
  const labelClass = size === 'compact' ? 'text-[10px]' : 'text-sm';
  return (
    <div className="flex items-center gap-2">
      <span className={`${labelClass} font-medium ${isBusiness ? 'text-muted-foreground' : 'text-foreground'}`}>PF</span>
      <Switch
        checked={isBusiness}
        onCheckedChange={(checked) => actions.onEntityTypeChange(checked ? 'business' : 'individual')}
        className={SWITCH_CLASS[size]}
        aria-label="Natureza: PF ou PJ"
      />
      <span className={`${labelClass} font-medium ${isBusiness ? 'text-foreground' : 'text-muted-foreground'}`}>PJ</span>
    </div>
  );
}

interface CategoryFieldProps extends FieldProps {
  categoryOptions: CategorySubcategories | null;
}

/** Category select (only categories of the row's type) with a free-text input for "Outros...". */
export function CategoryField({ transaction, draft, actions, categoryOptions, size }: CategoryFieldProps) {
  const categories =
    categoryOptions?.options.filter((c) => !transaction.type || !c.type || c.type === transaction.type) || [];
  return (
    <>
      <Select
        value={draft.customCategory ? OTHER_OPTION : transaction.category_id ? String(transaction.category_id) : ''}
        onValueChange={actions.onCategoryChange}
      >
        <SelectTrigger className={TRIGGER_CLASS[size]}>
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {categories.map((cat) => (
            <SelectItem key={cat.id} value={String(cat.id)}>
              {cat.name}
            </SelectItem>
          ))}
          <SelectItem value={OTHER_OPTION}>Outros...</SelectItem>
        </SelectContent>
      </Select>
      {draft.customCategory && (
        <Input
          placeholder="Nova categoria"
          value={draft.categoryName}
          onChange={(e) => actions.onCategoryNameChange(e.target.value)}
          className={INPUT_CLASS[size]}
        />
      )}
    </>
  );
}

/** Subcategory select of the chosen category with a free-text input for "Outros...". */
export function SubcategoryField({ transaction, draft, actions, categoryOptions, size }: CategoryFieldProps) {
  const category = categoryOptions?.options.find((c) => c.id === transaction.category_id);
  if (!category) return <span className="text-xs text-muted-foreground">-</span>;
  return (
    <>
      <Select
        value={
          draft.customSubcategory ? OTHER_OPTION : transaction.subcategory_id ? String(transaction.subcategory_id) : ''
        }
        onValueChange={actions.onSubcategoryChange}
      >
        <SelectTrigger className={TRIGGER_CLASS[size]}>
          <SelectValue placeholder="Selecione..." />
        </SelectTrigger>
        <SelectContent>
          {category.subcategories.map((sub) => (
            <SelectItem key={sub.id} value={String(sub.id)}>
              {sub.name}
            </SelectItem>
          ))}
          <SelectItem value={OTHER_OPTION}>Outros...</SelectItem>
        </SelectContent>
      </Select>
      {draft.customSubcategory && (
        <Input
          placeholder="Nova subcategoria"
          value={draft.subcategoryName}
          onChange={(e) => actions.onSubcategoryNameChange(e.target.value)}
          className={INPUT_CLASS[size]}
        />
      )}
    </>
  );
}
