import { useEffect, useState, useCallback } from 'react'
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { DollarSign, Save, BarChart3, Trash2, PlusCircle, CreditCard } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { FinancialService } from '@/services/financialService'

// ===== Types =====
interface Subcategory {
    name: string
    id: number | string
    isNew?: boolean
    isModified?: boolean
}

interface Category {
    name: string
    entity_type: 'pf' | 'pj' | 'mensal'
    limit: number
    id: number | string
    subcategories: Subcategory[]
    type?: string | null
    isNew?: boolean
    isModified?: boolean
}

// ===== Limits Tab =====
interface LimitsTabProps {
    entityTypeFilter?: 'pf' | 'pj' | 'all'
}

export const LimitsTab = ({ entityTypeFilter = 'all' }: LimitsTabProps) => {
    const [rawData, setRawData] = useState<Category[]>([])
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()

    // Map backend entity_type to local: 'individual'->'pf', 'business'->'pj'
    const mapEntityType = (et: string): 'pf' | 'pj' | 'mensal' => {
        if (et === 'individual') return 'pf'
        if (et === 'business') return 'pj'
        return 'mensal'
    }

    // Transform backend response to local Category type
    const transformCategory = (c: any): Category => ({
        ...c,
        name: c.name ?? c.category_name ?? '',
        entity_type: mapEntityType(c.entity_type),
        subcategories: (c.subcategories || []).map((s: any) => ({
            ...s,
            name: s.name ?? s.subcategory_name ?? '',
        })),
    })

    const data = rawData.filter(cat => {
        if (entityTypeFilter === 'all') return true
        return cat.entity_type === entityTypeFilter || cat.entity_type === 'mensal'
    })

    useEffect(() => {
        setLoading(true)
        FinancialService.getLimits()
            .then(fetched => {
                const mapped = fetched.map(transformCategory)
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

                const mensalPF = ensureCategory('Mensal PF', 'pf', 1000)
                const mensalPJ = ensureCategory('Mensal PJ', 'pj', 1000)
                const limiteCartao = ensureCategory('Limite Cartao Credito', 'pf', 5000)

                const specialNames = ['mensal pf', 'mensal pj', 'limite cartao credito', 'mensal']
                const rest = mapped.filter(c => !specialNames.includes(c.name.trim().toLowerCase()))

                setRawData([mensalPF, mensalPJ, limiteCartao, ...rest])
            })
            .catch(err => {
                console.error(err)
                toast({ title: 'Erro', description: 'Nao foi possivel carregar limites', variant: 'destructive' })
            })
            .finally(() => setLoading(false))
    }, [toast])

    const updateCategoryField = (catId: number | string, key: keyof Category, value: any) => {
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
            c.name.trim().toLowerCase() === 'limite cartao credito' && c.entity_type === entityType
        )
        if (existing) {
            updateCategoryField(existing.id, 'limit', value)
        } else {
            const tempId = `new_cc_${Date.now()}`
            setRawData(prev => [...prev, {
                id: tempId,
                name: 'Limite Cartao Credito',
                entity_type: entityType,
                limit: value,
                subcategories: [],
                isNew: true,
            }])
        }
    }

    const [deletedCategoryIds, setDeletedCategoryIds] = useState<number[]>([])

    const deleteCategory = (catId: number | string) => {
        // Track real IDs for backend deletion
        if (typeof catId === 'number') {
            setDeletedCategoryIds(prev => [...prev, catId])
        }
        setRawData(prev => prev.filter(cat => cat.id !== catId))
    }

    const preparePayloadForSave = () => {
        // Track (name, entity_type) combos of DB-backed categories to avoid duplicates;
        // keys are added here as new categories are processed so duplicates among them are skipped
        const existingKeys = new Set(
            data.filter(c => !c.isNew).map(c => `${c.name.trim().toLowerCase()}|${c.entity_type}`)
        )
        const payload: any = { new: [], modified: [], deleted: deletedCategoryIds }
        data.forEach(cat => {
            if (cat.isNew) {
                const key = `${cat.name.trim().toLowerCase()}|${cat.entity_type}`
                if (existingKeys.has(key)) {
                    return
                }
                existingKeys.add(key)
                payload.new.push({
                    category_name: cat.name,
                    entity_type: cat.entity_type === 'pf' ? 'individual' : cat.entity_type === 'pj' ? 'business' : cat.entity_type,
                    limit: cat.limit,
                    subcategories: cat.subcategories.filter(s => s.name.trim()).map(s => ({ subcategory_name: s.name }))
                })
            } else if (cat.isModified) {
                payload.modified.push({
                    id: cat.id,
                    category_name: cat.name,
                    entity_type: cat.entity_type === 'pf' ? 'individual' : cat.entity_type === 'pj' ? 'business' : cat.entity_type,
                    limit: cat.limit,
                    subcategories: cat.subcategories.map(sub => ({
                        ...(sub.isNew ? {} : { id: sub.id }),
                        subcategory_name: sub.name
                    })).filter(s => s.subcategory_name?.trim())
                })
            }
        })
        return payload
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            const res = await FinancialService.saveLimits(preparePayloadForSave())
            toast({ title: 'Sucesso', description: res.message })
            const refreshed = await FinancialService.getLimits()
            setRawData(refreshed.map(transformCategory))
            setDeletedCategoryIds([])
        } catch {
            toast({ title: 'Erro', description: 'Falha ao salvar limites.', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    const mensalPFItem = data.find(cat => cat.name.trim().toLowerCase() === 'mensal pf')
    const mensalPJItem = data.find(cat => cat.name.trim().toLowerCase() === 'mensal pj')
    const limiteCartaoPFItem = data.find(cat => cat.name.trim().toLowerCase() === 'limite cartao credito' && cat.entity_type === 'pf')
    const limiteCartaoPJItem = data.find(cat => cat.name.trim().toLowerCase() === 'limite cartao credito' && cat.entity_type === 'pj')
    const specialNames = ['mensal pf', 'mensal pj', 'limite cartao credito', 'mensal']
    const hasLimit = (c: Category) => !c.type || c.type === 'expense'
    const pfGroup = data.filter(cat => cat.entity_type === 'pf' && !specialNames.includes(cat.name.trim().toLowerCase()) && hasLimit(cat))
    const pjGroup = data.filter(cat => cat.entity_type === 'pj' && !specialNames.includes(cat.name.trim().toLowerCase()) && hasLimit(cat))

    // Which limit card to show
    const showMensalPF = entityTypeFilter === 'all' || entityTypeFilter === 'pf'
    const showMensalPJ = entityTypeFilter === 'all' || entityTypeFilter === 'pj'
    const showCartaoPF = entityTypeFilter === 'all' || entityTypeFilter === 'pf'
    const showCartaoPJ = entityTypeFilter === 'all' || entityTypeFilter === 'pj'

    const renderGroup = (title: string, icon: React.ReactNode, categories: Category[], natureza?: 'pf' | 'pj') => (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">{icon}<CardTitle className="text-lg font-semibold m-0">{title}</CardTitle></div>
                {natureza && (
                    <Button variant="outline" size="sm" onClick={() => addCategory(natureza)}>
                        <PlusCircle className="h-4 w-4 mr-2" />Nova Categoria
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-6">
                {categories.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">Nenhuma categoria. Clique em "Nova Categoria" para adicionar.</p>
                ) : (
                    categories.map(cat => (
                        <div key={cat.id} className="border rounded-lg bg-card p-4 space-y-4 relative">
                            {cat.isNew && (<div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">NOVO</div>)}
                            {cat.isModified && !cat.isNew && (<div className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">MODIFICADO</div>)}
                            <div className="flex items-end gap-4">
                                <div className="flex-1">
                                    <Label>Categoria</Label>
                                    <Input value={cat.name} placeholder="Nome da categoria" onChange={e => updateCategoryField(cat.id, 'name', e.target.value)} />
                                </div>
                                <div className="w-32">
                                    <Label>Limite (R$)</Label>
                                    <Input type="number" min="0" step="0.01" value={cat.limit} onChange={e => updateCategoryField(cat.id, 'limit', parseFloat(e.target.value) || 0)} />
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => deleteCategory(cat.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">Subcategorias</span>
                                    <Button variant="ghost" size="sm" onClick={() => addSubcategory(cat.id)}><PlusCircle className="h-4 w-4 mr-1" />Adicionar</Button>
                                </div>
                                {cat.subcategories.length === 0 ? (
                                    <p className="text-muted-foreground text-sm text-center py-2">Nenhuma subcategoria</p>
                                ) : (
                                    <div className="space-y-2">
                                        {cat.subcategories.map(sub => (
                                            <div key={sub.id} className="flex items-center gap-2 relative">
                                                {sub.isNew && (<div className="absolute -top-2 -right-2 bg-green-400 text-white text-xs px-1 py-0.5 rounded text-[10px] z-10">NOVO</div>)}
                                                {sub.isModified && !sub.isNew && (<div className="absolute -top-2 -right-2 bg-yellow-400 text-white text-xs px-1 py-0.5 rounded text-[10px] z-10">MOD</div>)}
                                                <Input value={sub.name} placeholder="Nome da subcategoria" onChange={e => updateSubcategoryField(cat.id, sub.id, e.target.value)} className="flex-1" />
                                                <Button variant="ghost" size="sm" onClick={() => deleteSubcategory(cat.id, sub.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    )

    return (
        <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {showMensalPF && (
                    <Card className="border-primary/50 shadow-md">
                        <CardHeader className="flex items-center gap-2 flex-row pb-2">
                            <div className="bg-primary/10 p-2 rounded-full"><DollarSign className="text-primary h-6 w-6" /></div>
                            <div><CardTitle className="text-lg">Limite Mensal PF</CardTitle><p className="text-sm text-muted-foreground">Orçamento mensal Pessoa Física</p></div>
                        </CardHeader>
                        <CardContent>
                            <div className="relative max-w-[200px]">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                                <Input type="number" className="pl-9 text-lg font-semibold" value={mensalPFItem?.limit || 0} onChange={e => { if (mensalPFItem) updateCategoryField(mensalPFItem.id, 'limit', parseFloat(e.target.value) || 0) }} />
                            </div>
                        </CardContent>
                    </Card>
                )}
                {showMensalPJ && (
                    <Card className="border-primary/50 shadow-md">
                        <CardHeader className="flex items-center gap-2 flex-row pb-2">
                            <div className="bg-primary/10 p-2 rounded-full"><DollarSign className="text-primary h-6 w-6" /></div>
                            <div><CardTitle className="text-lg">Limite Mensal PJ</CardTitle><p className="text-sm text-muted-foreground">Orçamento mensal Pessoa Jurídica</p></div>
                        </CardHeader>
                        <CardContent>
                            <div className="relative max-w-[200px]">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                                <Input type="number" className="pl-9 text-lg font-semibold" value={mensalPJItem?.limit || 0} onChange={e => { if (mensalPJItem) updateCategoryField(mensalPJItem.id, 'limit', parseFloat(e.target.value) || 0) }} />
                            </div>
                        </CardContent>
                    </Card>
                )}
                {showCartaoPF && (
                    <Card className="border-primary/50 shadow-md">
                        <CardHeader className="flex items-center gap-2 flex-row pb-2">
                            <div className="bg-primary/10 p-2 rounded-full"><CreditCard className="text-primary h-6 w-6" /></div>
                            <div><CardTitle className="text-lg">Limite Cartão PF</CardTitle><p className="text-sm text-muted-foreground">Limite total do cartão PF</p></div>
                        </CardHeader>
                        <CardContent>
                            <div className="relative max-w-[200px]">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                                <Input type="number" className="pl-9 text-lg font-semibold" value={limiteCartaoPFItem?.limit || 0} onChange={e => handleCartaoLimitChange('pf', parseFloat(e.target.value) || 0)} />
                            </div>
                        </CardContent>
                    </Card>
                )}
                {showCartaoPJ && (
                    <Card className="border-primary/50 shadow-md">
                        <CardHeader className="flex items-center gap-2 flex-row pb-2">
                            <div className="bg-primary/10 p-2 rounded-full"><CreditCard className="text-primary h-6 w-6" /></div>
                            <div><CardTitle className="text-lg">Limite Cartão PJ</CardTitle><p className="text-sm text-muted-foreground">Limite total do cartão PJ</p></div>
                        </CardHeader>
                        <CardContent>
                            <div className="relative max-w-[200px]">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                                <Input type="number" className="pl-9 text-lg font-semibold" value={limiteCartaoPJItem?.limit || 0} onChange={e => handleCartaoLimitChange('pj', parseFloat(e.target.value) || 0)} />
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
            {showMensalPF && renderGroup('Categorias Pessoa Física', <BarChart3 className="h-5 w-5 text-primary" />, pfGroup, 'pf')}
            {showMensalPJ && renderGroup('Categorias Pessoa Jurídica', <DollarSign className="h-5 w-5 text-primary" />, pjGroup, 'pj')}
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={loading} className="flex items-center gap-2" size="lg">
                    <Save className="h-4 w-4" />{loading ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
            </div>
        </div>
    )
}
