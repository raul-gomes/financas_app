import { useEffect, useMemo, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useErrorToast } from '@/hooks/queries/useErrorToast'
import { invalidateDomain, useLimitCategories, useLimitsWithSpending } from '@/hooks/queries/useLimitsQueries'
import { useToast } from '@/hooks/use-toast'
import { FinancialService } from '@/services/financialService'
import {
    CARD_LIMIT_NAME,
    SPECIAL_CATEGORY_NAMES,
    buildLimitsPayload,
    limitAlertFor,
    spendingKey,
    transformCategory,
    type Category,
    type CategorySpending,
    type LimitAlert,
} from './limitsModel'

/** Defaults used when a user has no monthly/card limit category yet. */
const DEFAULT_MONTHLY_LIMIT = 1000
const DEFAULT_CARD_LIMIT = 5000

type EntityScope = 'pf' | 'pj' | 'all'

/**
 * Editable draft of the limit categories (server data cached by react-query) plus the
 * actions both views (desktop table and mobile cards) share: field edits, adding and
 * removing, the pre-save "% used" warning and saving.
 */
export function useLimitsDraft(entityTypeFilter: EntityScope = 'all') {
    const queryClient = useQueryClient()
    // Server data is cached; `rawData` is the editable draft built from it
    const [rawData, setRawData] = useState<Category[]>([])
    const [deletedCategoryIds, setDeletedCategoryIds] = useState<number[]>([])
    const [saving, setSaving] = useState(false)
    const { toast } = useToast()
    const { data: fetchedLimits, isPending: loadingLimits, isError: limitsError } = useLimitCategories()
    const now = new Date()
    const { data: spendingData } = useLimitsWithSpending(now.getFullYear(), now.getMonth() + 1)
    useErrorToast(limitsError, 'Nao foi possivel carregar limites')

    const matchesFilter = (cat: Category) => entityTypeFilter === 'all' || cat.entity_type === entityTypeFilter || cat.entity_type === 'mensal'
    const data = rawData.filter(matchesFilter)

    // (Re)build the draft whenever the server data arrives or is refreshed (e.g. after saving)
    useEffect(() => {
        if (!fetchedLimits) return
        const mapped = fetchedLimits.map(transformCategory)
        const ensureCategory = (name: string, entity_type: 'pf' | 'pj', defaultLimit: number): Category => {
            const existing = mapped.find(c => c.name.trim().toLowerCase() === name.toLowerCase())
            if (existing) return existing
            return {
                id: `new_${name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`,
                name,
                entity_type,
                limit: defaultLimit,
                subcategories: [],
                isNew: true,
            }
        }

        const mensalPF = ensureCategory('Mensal PF', 'pf', DEFAULT_MONTHLY_LIMIT)
        const mensalPJ = ensureCategory('Mensal PJ', 'pj', DEFAULT_MONTHLY_LIMIT)
        const limiteCartao = ensureCategory(CARD_LIMIT_NAME, 'pf', DEFAULT_CARD_LIMIT)

        const rest = mapped.filter(c => !SPECIAL_CATEGORY_NAMES.includes(c.name.trim().toLowerCase()))

        setRawData([mensalPF, mensalPJ, limiteCartao, ...rest])
        setDeletedCategoryIds([])
    }, [fetchedLimits])

    // Month spending per category (key: name|pf/pj): feeds the pre-save "% used" warning
    const spending = useMemo(() => {
        const map: Record<string, number> = {}
        for (const cat of spendingData?.categories ?? []) {
            const entity = cat.entity_type === 'individual' ? 'pf' : cat.entity_type === 'business' ? 'pj' : cat.entity_type
            map[spendingKey(cat.category_name, entity)] = cat.spent
        }
        return map
    }, [spendingData])

    // The backend's own numbers per category (remaining, % used) for the mobile cards
    const spendingRows = useMemo(() => {
        const map: Record<string, CategorySpending> = {}
        for (const cat of spendingData?.categories ?? []) {
            const entity = cat.entity_type === 'individual' ? 'pf' : cat.entity_type === 'business' ? 'pj' : cat.entity_type
            map[spendingKey(cat.category_name, entity)] = {
                limit: cat.limit,
                spent: cat.spent,
                remaining: cat.remaining,
                percent_used: cat.percent_used,
            }
        }
        return map
    }, [spendingData])

    const limitAlert = (cat: Category): LimitAlert | null => limitAlertFor(cat, spending)

    const updateCategoryField = (catId: number | string, key: keyof Category, value: Category[keyof Category]) => {
        setRawData(prev => prev.map(cat => cat.id === catId ? { ...{ ...cat, [key]: value }, isModified: !cat.isNew && cat.isModified !== false ? true : cat.isModified } : cat))
    }

    const updateSubcategoryField = (catId: number | string, subId: number | string, value: string) => {
        setRawData(prev => prev.map(cat => {
            if (cat.id !== catId) return cat
            return { ...cat, subcategories: cat.subcategories.map(sub => sub.id === subId ? { ...sub, name: value, isModified: !sub.isNew } : sub), isModified: !cat.isNew }
        }))
    }

    const addSubcategory = (catId: number | string) => {
        setRawData(prev => prev.map(cat => cat.id === catId ? { ...cat, subcategories: [...cat.subcategories, { id: `new_sub_${Date.now()}`, name: '', isNew: true }], isModified: !cat.isNew } : cat))
    }

    const deleteSubcategory = (catId: number | string, subId: number | string) => {
        setRawData(prev => prev.map(cat => cat.id === catId ? { ...cat, subcategories: cat.subcategories.filter(s => s.id !== subId), isModified: !cat.isNew } : cat))
    }

    const addCategory = (entity_type: 'pf' | 'pj') => {
        setRawData(prev => [...prev, { id: `new_cat_${Date.now()}`, name: '', entity_type, limit: 0, subcategories: [], isNew: true }])
    }

    // Handle credit card limit change, auto-creating the category if it doesn't exist
    const handleCartaoLimitChange = (entityType: 'pf' | 'pj', value: number) => {
        const existing = rawData.find(c =>
            c.name.trim().toLowerCase() === CARD_LIMIT_NAME.toLowerCase() && c.entity_type === entityType
        )
        if (existing) {
            updateCategoryField(existing.id, 'limit', value)
        } else {
            const tempId = `new_cc_${Date.now()}`
            setRawData(prev => [...prev, {
                id: tempId,
                name: CARD_LIMIT_NAME,
                entity_type: entityType,
                limit: value,
                subcategories: [],
                isNew: true,
            }])
        }
    }

    const deleteCategory = (catId: number | string) => {
        // Track real IDs for backend deletion
        if (typeof catId === 'number') {
            setDeletedCategoryIds(prev => [...prev, catId])
        }
        setRawData(prev => prev.filter(cat => cat.id !== catId))
    }

    /**
     * Persists `categories` (the draft) with the pending deletions: warns about limits
     * close to being exceeded, saves, then refetches limits and spending (which rebuilds the draft).
     */
    const persist = async (categories: Category[], deletedIds: number[]) => {
        const visible = categories.filter(matchesFilter)
        const affected = visible
            .map(cat => ({ cat, alert: limitAlert(cat) }))
            .filter((x): x is { cat: Category; alert: LimitAlert } => x.alert !== null)
        if (affected.length > 0) {
            toast({
                title: 'Atenção: limites próximos do estouro',
                description: affected.map(({ cat, alert }) => `"${cat.name}" (${alert.percent}%)`).join(', '),
            })
        }

        setSaving(true)
        try {
            const res = await FinancialService.saveLimits(buildLimitsPayload(visible, deletedIds))
            toast({ title: 'Sucesso', description: res.message })
            await invalidateDomain(queryClient, 'limits')
            return true
        } catch {
            toast({ title: 'Erro', description: 'Falha ao salvar limites.', variant: 'destructive' })
            return false
        } finally {
            setSaving(false)
        }
    }

    const handleSave = () => persist(rawData, deletedCategoryIds)

    /** Mobile edit sheet: replaces (or adds) one category in the draft and saves right away. */
    const saveCategory = (cat: Category) => {
        const exists = rawData.some(c => c.id === cat.id)
        const next = exists ? rawData.map(c => (c.id === cat.id ? cat : c)) : [...rawData, cat]
        setRawData(next)
        // Only this category is sent: the default monthly/card limits that were never saved stay out of it
        return persist(next.filter(c => c.id === cat.id || !c.isNew), deletedCategoryIds)
    }

    /** Mobile edit sheet: removes one category and saves right away. */
    const removeCategory = (cat: Category) => {
        const deleted = typeof cat.id === 'number' ? [...deletedCategoryIds, cat.id] : deletedCategoryIds
        const next = rawData.filter(c => c.id !== cat.id)
        setDeletedCategoryIds(deleted)
        setRawData(next)
        return persist(next.filter(c => !c.isNew), deleted)
    }

    return {
        rawData,
        data,
        loading: loadingLimits || saving,
        saving,
        spendingRows,
        limitAlert,
        updateCategoryField,
        updateSubcategoryField,
        addSubcategory,
        deleteSubcategory,
        addCategory,
        handleCartaoLimitChange,
        deleteCategory,
        handleSave,
        saveCategory,
        removeCategory,
    }
}
