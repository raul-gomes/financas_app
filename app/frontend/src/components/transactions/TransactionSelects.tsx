import { Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { BankLogo, BankLogoFallback } from '@/components/ui/bank-logo';
import { categoryLabel } from '@/lib/transactionLabels';
import type { TransactionForm } from './useTransactionForm';

interface FieldProps {
  form: TransactionForm;
}

/**
 * Category field: a select of the user's categories plus "Outra" (free text). Income and
 * investments have a fixed automatic category, shown in a disabled input.
 */
export function CategoryField({ form }: FieldProps) {
  const { values, setValues, categoryOptions, newCategory } = form;
  const fixedCategory = values.type === 'income' || values.type === 'investment';
  return (
    <div className="space-y-2">
      <Label htmlFor="category_name">Categoria *</Label>
      {fixedCategory ? (
        <Input id="category_name" value={categoryLabel(values.category_name)} disabled className="bg-muted cursor-not-allowed" />
      ) : (
        <>
          <Select
            value={newCategory.active ? 'other' : values.category_name}
            onValueChange={(value) => {
              if (value === 'other') {
                newCategory.activate();
                setValues({ category_name: '', subcategory_name: '' });
              } else {
                newCategory.deactivate();
                setValues({ category_name: value, subcategory_name: '' });
              }
            }}
          >
            <SelectTrigger id="category_name">
              <SelectValue placeholder="Selecione uma categoria" />
            </SelectTrigger>
            <SelectContent>
              {categoryOptions?.options.map((cat) => (
                <SelectItem key={cat.id} value={cat.name}>
                  {cat.name}
                </SelectItem>
              ))}
              <SelectItem value="other">Outra</SelectItem>
            </SelectContent>
          </Select>
          {newCategory.active && (
            <div className="space-y-2 mt-2">
              <Label htmlFor="newCategory">Nova categoria</Label>
              <Input
                id="newCategory"
                placeholder="Digite a nova categoria"
                value={newCategory.text}
                onChange={(e) => {
                  newCategory.setText(e.target.value);
                  setValues({ category_name: e.target.value.trim(), subcategory_name: '' });
                }}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Subcategory field of the chosen category (hidden until a category is set), with "Outra". */
export function SubcategoryField({ form }: FieldProps) {
  const { values, setValues, categoryOptions, newSubcategory } = form;
  if (!values.category_name) return null;
  const subcategories = categoryOptions?.options.find((c) => c.name === values.category_name)?.subcategories ?? [];
  return (
    <div className="space-y-2">
      <Label htmlFor="subcategory_name">Subcategoria *</Label>
      <Select
        value={newSubcategory.active ? 'other' : values.subcategory_name}
        onValueChange={(value) => {
          if (value === 'other') {
            newSubcategory.activate();
            setValues({ subcategory_name: '' });
          } else {
            newSubcategory.deactivate();
            setValues({ subcategory_name: value });
          }
        }}
      >
        <SelectTrigger id="subcategory_name">
          <SelectValue placeholder="Selecione uma subcategoria" />
        </SelectTrigger>
        <SelectContent>
          {subcategories.map((sub) => (
            <SelectItem key={sub.id} value={sub.name}>
              {sub.name}
            </SelectItem>
          ))}
          <SelectItem value="other">Outra</SelectItem>
        </SelectContent>
      </Select>
      {newSubcategory.active && (
        <div className="space-y-2 mt-2">
          <Label htmlFor="newSubcategory">Nova subcategoria</Label>
          <Input
            id="newSubcategory"
            placeholder="Digite a nova subcategoria"
            value={newSubcategory.text}
            onChange={(e) => {
              newSubcategory.setText(e.target.value);
              setValues({ subcategory_name: e.target.value.trim() });
            }}
          />
        </div>
      )}
    </div>
  );
}

/** Bank select with the user's banks and "Adicionar novo banco" (the search box is rendered by the layout). */
export function BankField({ form }: FieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor="bank">Banco</Label>
      <Select
        value={form.addingNewBank ? '+add' : form.bankCode}
        onValueChange={(value) => {
          if (value === '+add') {
            form.setAddingNewBank(true);
          } else {
            form.setAddingNewBank(false);
            form.setBankCode(value);
          }
        }}
      >
        <SelectTrigger id="bank">
          <SelectValue placeholder="Selecione um banco" />
        </SelectTrigger>
        <SelectContent>
          {form.banks.map((bank, idx) => (
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
          ))}
          <SelectItem value="+add">
            <div className="flex items-center gap-2 text-primary font-medium">
              <Plus className="w-4 h-4" />
              <span>Adicionar novo banco</span>
            </div>
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
