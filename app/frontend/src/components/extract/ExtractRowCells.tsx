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

interface CellProps {
  transaction: ParsedTransaction;
  draft: RowDraft;
  actions: RowActions;
}

/** Installments switch plus the total input when it is on. */
export function InstallmentsCell({ rowId, draft, actions }: Pick<CellProps, 'draft' | 'actions'> & { rowId: string }) {
  return (
    <td className="px-3 py-2 whitespace-nowrap">
      <div className="flex items-center gap-1">
        <Switch
          id={`parcelado-${rowId}`}
          checked={draft.installment}
          onCheckedChange={actions.onInstallmentToggle}
          className="scale-75"
        />
        {draft.installment && (
          <Input
            type="number"
            min={MIN_INSTALLMENTS}
            value={draft.totalInstallments || DEFAULT_INSTALLMENTS}
            onChange={(e) => actions.onTotalInstallmentsChange(e.target.value)}
            className="h-7 w-14 text-xs"
          />
        )}
      </div>
    </td>
  );
}

/** Payment method select with a free-text input for "Outros...". */
export function PaymentMethodCell({ transaction, draft, actions }: CellProps) {
  return (
    <td className="px-3 py-2 min-w-[120px]">
      <Select
        value={draft.customPaymentMethod ? OTHER_OPTION : transaction.payment_method}
        onValueChange={actions.onPaymentMethodChange}
      >
        <SelectTrigger className="h-7 text-xs">
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
          className="h-7 text-xs mt-1"
        />
      )}
    </td>
  );
}

/** PF/PJ switch. */
export function EntityTypeCell({ transaction, actions }: Pick<CellProps, 'transaction' | 'actions'>) {
  const isBusiness = transaction.entity_type === 'business';
  return (
    <td className="px-3 py-2">
      <div className="flex items-center gap-1">
        <span className={`text-[10px] font-medium ${isBusiness ? 'text-muted-foreground' : 'text-foreground'}`}>PF</span>
        <Switch
          checked={isBusiness}
          onCheckedChange={(checked) => actions.onEntityTypeChange(checked ? 'business' : 'individual')}
          className="scale-75"
        />
        <span className={`text-[10px] font-medium ${isBusiness ? 'text-foreground' : 'text-muted-foreground'}`}>PJ</span>
      </div>
    </td>
  );
}

interface CategoryCellProps extends CellProps {
  categoryOptions: CategorySubcategories | null;
}

/** Category select (only categories of the row's type) with a free-text input for "Outros...". */
export function CategoryCell({ transaction, draft, actions, categoryOptions }: CategoryCellProps) {
  const categories =
    categoryOptions?.options.filter((c) => !transaction.type || !c.type || c.type === transaction.type) || [];
  return (
    <td className="px-3 py-2 min-w-[130px]">
      <Select
        value={draft.customCategory ? OTHER_OPTION : transaction.category_id ? String(transaction.category_id) : ''}
        onValueChange={actions.onCategoryChange}
      >
        <SelectTrigger className="h-7 text-xs">
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
          className="h-7 text-xs mt-1"
        />
      )}
    </td>
  );
}

/** Subcategory select of the chosen category with a free-text input for "Outros...". */
export function SubcategoryCell({ transaction, draft, actions, categoryOptions }: CategoryCellProps) {
  const category = categoryOptions?.options.find((c) => c.id === transaction.category_id);
  const subcategories = category?.subcategories || [];
  return (
    <td className="px-3 py-2 min-w-[130px]">
      {category ? (
        <>
          <Select
            value={
              draft.customSubcategory ? OTHER_OPTION : transaction.subcategory_id ? String(transaction.subcategory_id) : ''
            }
            onValueChange={actions.onSubcategoryChange}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {subcategories.map((sub) => (
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
              className="h-7 text-xs mt-1"
            />
          )}
        </>
      ) : (
        <span className="text-xs text-muted-foreground">-</span>
      )}
    </td>
  );
}
