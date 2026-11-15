import { useState } from 'react'
import { PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { MobileTopBarSlot } from '@/components/layout/MobileTopBar'
import { formatCurrency, formatNumber } from '@/lib/format'
import { cn } from '@/lib/utils'
import { LimitEditSheet } from './LimitEditSheet'
import {
    CARD_LIMIT_NAME,
    SPECIAL_CATEGORY_NAMES,
    limitStatus,
    spendingKey,
    type Category,
    type CategorySpending,
    type LimitAlert,
} from './limitsModel'

type Scope = 'pf' | 'pj'

const TONE_CLASSES = {
    ok: { bar: 'bg-primary', text: 'text-muted-foreground', amount: 'text-foreground' },
    warning: { bar: 'bg-warning', text: 'text-muted-foreground', amount: 'text-foreground' },
    destructive: { bar: 'bg-destructive', text: 'text-destructive', amount: 'text-destructive' },
} as const

interface LimitsCardsProps {
    scope: Scope
    /** Categories visible for the scope (monthly, card and regular ones). */
    categories: Category[]
    spendingRows: Record<string, CategorySpending>
    saving: boolean
    alertFor: (category: Category) => LimitAlert | null
    onSave: (category: Category) => Promise<boolean>
    onRemove: (category: Category) => Promise<boolean>
}

interface Editing {
    category: Category
    isNew: boolean
    nameLocked: boolean
    limitLabel: string
}

const isSpecial = (cat: Category) => SPECIAL_CATEGORY_NAMES.includes(cat.name.trim().toLowerCase())
const hasLimit = (cat: Category) => !cat.type || cat.type === 'expense'

/** "R$ 5.865 / 3.500": amounts without trailing zeros so the header stays on one line. */
const shortAmount = (value: number) => formatNumber(value, { maximumFractionDigits: 2 })

interface CardProps {
    title: string
    limit: number
    spending: CategorySpending | undefined
    onOpen: () => void
}

function LimitCard({ title, limit, spending, onOpen }: CardProps) {
    const status = spending ? limitStatus({ ...spending, limit }) : null
    const tone = status ? TONE_CLASSES[status.tone] : null
    return (
        <button
            type="button"
            onClick={onOpen}
            className="block w-full rounded-2xl border border-border bg-card p-3.5 text-left shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
            <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-semibold text-foreground">{title}</span>
                <span className={cn('shrink-0 whitespace-nowrap text-sm font-bold', tone?.amount ?? 'text-foreground')}>
                    {spending ? `R$ ${shortAmount(spending.spent)} / ${shortAmount(limit)}` : formatCurrency(limit)}
                </span>
            </span>
            {status && tone ? (
                <>
                    <span className="mt-2 block h-2 w-full overflow-hidden rounded-full bg-secondary">
                        <span className={cn('block h-full rounded-full', tone.bar)} style={{ width: `${status.percent}%` }} />
                    </span>
                    <span className={cn('mt-1.5 block text-xs', tone.text)}>
                        {status.kind === 'over'
                            ? `Passou ${formatCurrency(status.amount)} do limite`
                            : `Restam ${formatCurrency(status.amount)}`}
                    </span>
                </>
            ) : (
                <span className="mt-1.5 block text-xs text-muted-foreground">Toque para definir o limite</span>
            )}
        </button>
    )
}

/**
 * Categories tab below `md`: one card per limit (monthly, credit card, categories) with
 * progress bar and "Restam R$ X" / "Passou R$ X do limite". Tapping a card opens the edit
 * sheet; the top bar "+" creates a new category.
 */
export function LimitsCards({ scope, categories, spendingRows, saving, alertFor, onSave, onRemove }: LimitsCardsProps) {
    const [editing, setEditing] = useState<Editing | null>(null)

    const monthlyName = scope === 'pf' ? 'mensal pf' : 'mensal pj'
    const monthly = categories.find(c => c.name.trim().toLowerCase() === monthlyName)
    const card = categories.find(c => c.name.trim().toLowerCase() === CARD_LIMIT_NAME.toLowerCase() && c.entity_type === scope)
    const regular = categories.filter(c => c.entity_type === scope && !isSpecial(c) && hasLimit(c))

    const spendingOf = (cat: Category) => spendingRows[spendingKey(cat.name, cat.entity_type)]

    // The credit card limit of a scope may not exist yet: editing it creates the category
    const cardToEdit: Category = card ?? {
        id: `new_cc_${scope}`,
        name: CARD_LIMIT_NAME,
        entity_type: scope,
        limit: 0,
        subcategories: [],
        isNew: true,
    }

    const finish = async (action: Promise<boolean>) => {
        if (await action) setEditing(null)
    }

    return (
        <div className="space-y-3">
            <MobileTopBarSlot>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Novo limite"
                    onClick={() =>
                        setEditing({
                            category: { id: `new_cat_${Date.now()}`, name: '', entity_type: scope, limit: 0, subcategories: [], isNew: true },
                            isNew: true,
                            nameLocked: false,
                            limitLabel: 'Limite mensal',
                        })
                    }
                >
                    <PlusCircle className="!size-6" aria-hidden="true" />
                </Button>
            </MobileTopBarSlot>

            {monthly && (
                <LimitCard
                    title={`Limite mensal ${scope.toUpperCase()}`}
                    limit={monthly.limit}
                    spending={spendingOf(monthly)}
                    onOpen={() =>
                        setEditing({ category: monthly, isNew: false, nameLocked: true, limitLabel: 'Orçamento mensal' })
                    }
                />
            )}
            <LimitCard
                title={`Limite do cartão ${scope.toUpperCase()}`}
                limit={cardToEdit.limit}
                spending={spendingOf(cardToEdit)}
                onOpen={() => setEditing({ category: cardToEdit, isNew: false, nameLocked: true, limitLabel: 'Limite total do cartão' })}
            />

            {regular.length === 0 ? (
                <EmptyState title="Nenhuma categoria" description="Toque em + para criar o primeiro limite." />
            ) : (
                regular.map(cat => (
                    <LimitCard
                        key={cat.id}
                        title={cat.name}
                        limit={cat.limit}
                        spending={spendingOf(cat)}
                        onOpen={() => setEditing({ category: cat, isNew: !!cat.isNew, nameLocked: false, limitLabel: 'Limite mensal' })}
                    />
                ))
            )}
            <p className="text-center text-[13px] text-muted-foreground">Toque num card para editar o valor</p>

            {editing && (
                <LimitEditSheet
                    key={String(editing.category.id)}
                    category={editing.category}
                    isNew={editing.isNew}
                    nameLocked={editing.nameLocked}
                    limitLabel={editing.limitLabel}
                    saving={saving}
                    alertFor={alertFor}
                    onSave={cat => void finish(onSave(cat))}
                    onDelete={cat => void finish(onRemove(cat))}
                    onClose={() => setEditing(null)}
                />
            )}
        </div>
    )
}
