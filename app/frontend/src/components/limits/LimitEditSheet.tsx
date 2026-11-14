import { useRef, useState } from 'react'
import { PlusCircle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { CurrencyInput } from '@/components/ui/currency-input'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ResponsiveModal } from '@/components/ui/responsive-modal'
import { LimitAlertBanner } from './LimitAlertBanner'
import type { Category, LimitAlert, Subcategory } from './limitsModel'

interface LimitEditSheetProps {
    category: Category
    /** A category being created (no delete, title "Novo limite"). */
    isNew: boolean
    /** Monthly/card limits: only the amount is editable. */
    nameLocked: boolean
    /** Label of the amount field. */
    limitLabel?: string
    saving: boolean
    /** Pre-save warning for the edited category (null = none). */
    alertFor: (category: Category) => LimitAlert | null
    onSave: (category: Category) => void
    onDelete: (category: Category) => void
    onClose: () => void
}

const FORM_ID = 'limit-edit-form'

/**
 * Bottom sheet that edits one limit on mobile: full-width name, a big amount field with
 * the decimal keypad, the subcategories and (for existing categories) delete with confirmation.
 */
export function LimitEditSheet({
    category,
    isNew,
    nameLocked,
    limitLabel = 'Limite mensal',
    saving,
    alertFor,
    onSave,
    onDelete,
    onClose,
}: LimitEditSheetProps) {
    const [name, setName] = useState(category.name)
    const [limit, setLimit] = useState(String(category.limit || ''))
    const [subcategories, setSubcategories] = useState<Subcategory[]>(category.subcategories)
    const [confirmingDelete, setConfirmingDelete] = useState(false)
    const nextSubId = useRef(0)

    const draft = (): Category => ({
        ...category,
        name: nameLocked ? category.name : name.trim(),
        limit: parseFloat(limit) || 0,
        subcategories,
        isModified: !category.isNew,
    })
    const alert = alertFor(draft())
    const canSave = nameLocked || name.trim() !== ''

    const updateSub = (id: number | string, value: string) =>
        setSubcategories(prev => prev.map(s => (s.id === id ? { ...s, name: value, isModified: !s.isNew } : s)))
    const addSub = () => {
        nextSubId.current += 1
        setSubcategories(prev => [...prev, { id: `new_sub_${nextSubId.current}`, name: '', isNew: true }])
    }

    return (
        <>
            <ResponsiveModal
                open
                onOpenChange={open => !open && onClose()}
                title={isNew ? 'Novo limite' : category.name}
                description="Toque em Salvar para aplicar o novo valor."
                size="sm"
                footer={
                    <Button type="submit" form={FORM_ID} className="w-full" disabled={!canSave || saving}>
                        {saving ? 'Salvando...' : 'Salvar'}
                    </Button>
                }
            >
                <form
                    id={FORM_ID}
                    className="space-y-4"
                    onSubmit={event => {
                        event.preventDefault()
                        if (canSave) onSave(draft())
                    }}
                >
                    {!nameLocked && (
                        <div className="space-y-1.5">
                            <Label htmlFor="limit-name">Nome da categoria</Label>
                            <Input
                                id="limit-name"
                                className="w-full"
                                placeholder="Ex.: Moradia"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <Label htmlFor="limit-amount">{limitLabel}</Label>
                        <CurrencyInput
                            id="limit-amount"
                            className="h-14 max-md:h-14 text-2xl font-bold md:text-2xl"
                            placeholder="0,00"
                            value={limit}
                            onChange={setLimit}
                        />
                    </div>
                    {alert && <LimitAlertBanner categoryName={nameLocked ? category.name : name || category.name} alert={alert} />}

                    {!nameLocked && (
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium">Subcategorias</span>
                                <Button type="button" variant="ghost" size="sm" onClick={addSub} aria-label="Adicionar subcategoria">
                                    <PlusCircle aria-hidden="true" />
                                    Adicionar
                                </Button>
                            </div>
                            {subcategories.length === 0 ? (
                                <p className="py-1 text-sm text-muted-foreground">Nenhuma subcategoria</p>
                            ) : (
                                subcategories.map((sub, index) => (
                                    <div key={sub.id} className="flex items-center gap-2">
                                        <Input
                                            aria-label={`Subcategoria ${index + 1}`}
                                            className="w-full min-w-0 flex-1"
                                            placeholder="Nome da subcategoria"
                                            value={sub.name}
                                            onChange={e => updateSub(sub.id, e.target.value)}
                                        />
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="shrink-0 text-destructive hover:text-destructive"
                                            aria-label={`Excluir subcategoria ${index + 1}`}
                                            onClick={() => setSubcategories(prev => prev.filter(s => s.id !== sub.id))}
                                        >
                                            <Trash2 aria-hidden="true" />
                                        </Button>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {!nameLocked && !isNew && (
                        <Button
                            type="button"
                            variant="outline"
                            className="w-full text-destructive hover:text-destructive"
                            onClick={() => setConfirmingDelete(true)}
                        >
                            <Trash2 aria-hidden="true" />
                            Excluir categoria
                        </Button>
                    )}
                </form>
            </ResponsiveModal>
            <ConfirmDialog
                open={confirmingDelete}
                onOpenChange={setConfirmingDelete}
                title="Excluir esta categoria?"
                description="Esta ação não pode ser desfeita."
                destructive
                confirmLabel="Excluir"
                onConfirm={() => onDelete(category)}
            />
        </>
    )
}
