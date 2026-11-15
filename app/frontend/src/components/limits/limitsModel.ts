// Editable model of the limits screen (categories with limits) and its pure helpers.

export interface Subcategory {
    name: string
    id: number | string
    isNew?: boolean
    isModified?: boolean
}

export interface Category {
    name: string
    entity_type: 'pf' | 'pj' | 'mensal'
    limit: number
    id: number | string
    subcategories: Subcategory[]
    type?: string | null
    isNew?: boolean
    isModified?: boolean
}

/** Subcategory as returned by the backend (name may come as subcategory_name). */
interface RawSubcategory {
    id: number | string
    name?: string
    subcategory_name?: string
}

/** Category as returned by the backend (name may come as category_name). */
export interface RawCategory {
    id: number | string
    name?: string
    category_name?: string
    entity_type: string
    limit: number
    type?: string | null
    subcategories?: RawSubcategory[]
}

/** Body sent to save the limits; items follow the backend contract. */
export interface LimitsSaveBody {
    new: Record<string, unknown>[]
    modified: Record<string, unknown>[]
    deleted: number[]
}

export type LimitSeverity = 'warning' | 'critical' | 'destructive'

export interface LimitAlert {
    severity: LimitSeverity
    percent: number
    spent: number
}

/** Month spending of one category, as the backend computes it (`/limits/with-spending`). */
export interface CategorySpending {
    limit: number
    spent: number
    remaining: number
    percent_used: number
}

/** Usage (percent of the limit) from which a limit counts as close to being exceeded; same as the backend overview. */
const LIMIT_WARNING_PERCENT = 70
const ALERT_WARNING_PERCENT = 80
const ALERT_CRITICAL_PERCENT = 90
const ALERT_EXCEEDED_PERCENT = 100

/** Names of the special categories that hold the monthly and credit card limits. */
export const SPECIAL_CATEGORY_NAMES = ['mensal pf', 'mensal pj', 'limite cartao credito', 'mensal']
export const CARD_LIMIT_NAME = 'Limite Cartao Credito'

/** Key used to match a category with its spending: lower-cased name + scope. */
export const spendingKey = (name: string, entityType: string): string =>
    `${name.trim().toLowerCase()}|${entityType}`

// Map backend entity_type to local: 'individual'->'pf', 'business'->'pj'
export const mapEntityType = (et: string): 'pf' | 'pj' | 'mensal' => {
    if (et === 'individual') return 'pf'
    if (et === 'business') return 'pj'
    return 'mensal'
}

const toBackendEntityType = (et: Category['entity_type']): string =>
    et === 'pf' ? 'individual' : et === 'pj' ? 'business' : et

// Transform backend response to local Category type
export const transformCategory = (c: RawCategory): Category => ({
    ...c,
    name: c.name ?? c.category_name ?? '',
    entity_type: mapEntityType(c.entity_type),
    subcategories: (c.subcategories || []).map((s: RawSubcategory) => ({
        ...s,
        name: s.name ?? s.subcategory_name ?? '',
    })),
})

/**
 * Builds the save body from the visible categories. New categories that duplicate an
 * existing (name, scope) are skipped; subcategories without a name are dropped.
 */
export function buildLimitsPayload(categories: Category[], deletedIds: number[]): LimitsSaveBody {
    const existingKeys = new Set(
        categories.filter(c => !c.isNew).map(c => spendingKey(c.name, c.entity_type))
    )
    const payload: LimitsSaveBody = { new: [], modified: [], deleted: deletedIds }
    categories.forEach(cat => {
        if (cat.isNew) {
            const key = spendingKey(cat.name, cat.entity_type)
            if (existingKeys.has(key)) return
            existingKeys.add(key)
            payload.new.push({
                category_name: cat.name,
                entity_type: toBackendEntityType(cat.entity_type),
                limit: cat.limit,
                subcategories: cat.subcategories.filter(s => s.name.trim()).map(s => ({ subcategory_name: s.name })),
            })
        } else if (cat.isModified) {
            payload.modified.push({
                id: cat.id,
                category_name: cat.name,
                entity_type: toBackendEntityType(cat.entity_type),
                limit: cat.limit,
                subcategories: cat.subcategories
                    .map(sub => ({
                        ...(sub.isNew ? {} : { id: sub.id }),
                        subcategory_name: sub.name,
                    }))
                    .filter(s => s.subcategory_name?.trim()),
            })
        }
    })
    return payload
}

/**
 * Pre-save warning: real month spending over the typed limit. `spending` maps
 * `spendingKey` to the amount spent. Null below 80%, without a limit or without a name.
 */
export function limitAlertFor(cat: Category, spending: Record<string, number>): LimitAlert | null {
    const spent = spending[spendingKey(cat.name, cat.entity_type)] ?? 0
    const limit = cat.limit || 0
    if (limit <= 0 || cat.name.trim() === '') return null
    const percent = Math.round((spent / limit) * 100)
    if (percent < ALERT_WARNING_PERCENT) return null
    const severity: LimitSeverity =
        percent >= ALERT_EXCEEDED_PERCENT ? 'destructive' : percent >= ALERT_CRITICAL_PERCENT ? 'critical' : 'warning'
    return { severity, percent, spent }
}

export interface LimitStatus {
    kind: 'remaining' | 'over'
    /** Amount left ("Restam") or exceeded ("Passou"), always positive. */
    amount: number
    /** Fill of the progress bar, 0-100. */
    percent: number
    tone: 'ok' | 'warning' | 'destructive'
}

/** What a limit card shows, from the backend's own spending numbers (no recomputation). */
export function limitStatus(spending: CategorySpending): LimitStatus {
    if (spending.remaining < 0) {
        return { kind: 'over', amount: -spending.remaining, percent: 100, tone: 'destructive' }
    }
    const percent = Math.min(100, spending.percent_used)
    return {
        kind: 'remaining',
        amount: spending.remaining,
        percent,
        tone: spending.percent_used >= LIMIT_WARNING_PERCENT ? 'warning' : 'ok',
    }
}
