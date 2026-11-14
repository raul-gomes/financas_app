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
import { useIsMobile } from '@/hooks/use-mobile'
import { LimitAlertBanner } from './LimitAlertBanner'
import { LimitsCards } from './LimitsCards'
import { SPECIAL_CATEGORY_NAMES, type Category } from './limitsModel'
import { useLimitsDraft } from './useLimitsDraft'

// ===== Limits Tab =====
interface LimitsTabProps {
    entityTypeFilter?: 'pf' | 'pj' | 'all'
}

export const LimitsTab = ({ entityTypeFilter = 'all' }: LimitsTabProps) => {
    const isMobile = useIsMobile()
    const {
        data,
        loading,
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
    } = useLimitsDraft(entityTypeFilter)

    // Mobile: one card per limit, edited in a bottom sheet (the PF/PJ scope is never "all" there)
    if (isMobile) {
        return (
            <LimitsCards
                scope={entityTypeFilter === 'pj' ? 'pj' : 'pf'}
                categories={data}
                spendingRows={spendingRows}
                saving={saving}
                alertFor={limitAlert}
                onSave={saveCategory}
                onRemove={removeCategory}
            />
        )
    }

    const mensalPFItem = data.find(cat => cat.name.trim().toLowerCase() === 'mensal pf')
    const mensalPJItem = data.find(cat => cat.name.trim().toLowerCase() === 'mensal pj')
    const limiteCartaoPFItem = data.find(cat => cat.name.trim().toLowerCase() === 'limite cartao credito' && cat.entity_type === 'pf')
    const limiteCartaoPJItem = data.find(cat => cat.name.trim().toLowerCase() === 'limite cartao credito' && cat.entity_type === 'pj')
    const hasLimit = (c: Category) => !c.type || c.type === 'expense'
    const pfGroup = data.filter(cat => cat.entity_type === 'pf' && !SPECIAL_CATEGORY_NAMES.includes(cat.name.trim().toLowerCase()) && hasLimit(cat))
    const pjGroup = data.filter(cat => cat.entity_type === 'pj' && !SPECIAL_CATEGORY_NAMES.includes(cat.name.trim().toLowerCase()) && hasLimit(cat))

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
                            {cat.isNew && (<div className="absolute -top-2 -right-2 bg-success text-success-foreground text-xs px-2 py-1 rounded-full">NOVO</div>)}
                            {cat.isModified && !cat.isNew && (<div className="absolute -top-2 -right-2 bg-warning text-warning-foreground text-xs px-2 py-1 rounded-full">MODIFICADO</div>)}
                            <div className="flex items-end gap-4">
                                <div className="flex-1">
                                    <Label>Categoria</Label>
                                    <Input value={cat.name} placeholder="Nome da categoria" onChange={e => updateCategoryField(cat.id, 'name', e.target.value)} />
                                </div>
                                <div className="w-32">
                                    <Label>Limite (R$)</Label>
                                    <Input type="number" min="0" step="0.01" value={cat.limit} onChange={e => updateCategoryField(cat.id, 'limit', parseFloat(e.target.value) || 0)} />
                                </div>
                                <Button aria-label="Excluir categoria" variant="ghost" size="sm" onClick={() => deleteCategory(cat.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                            {(() => {
                                const alert = limitAlert(cat)
                                return alert ? <LimitAlertBanner categoryName={cat.name} alert={alert} /> : null
                            })()}
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
                                                {sub.isNew && (<div className="absolute -top-2 -right-2 bg-success/80 text-success-foreground text-xs px-1 py-0.5 rounded text-[10px] z-10">NOVO</div>)}
                                                {sub.isModified && !sub.isNew && (<div className="absolute -top-2 -right-2 bg-warning/80 text-warning-foreground text-xs px-1 py-0.5 rounded text-[10px] z-10">MOD</div>)}
                                                <Input value={sub.name} placeholder="Nome da subcategoria" onChange={e => updateSubcategoryField(cat.id, sub.id, e.target.value)} className="flex-1" />
                                                <Button aria-label="Excluir subcategoria" variant="ghost" size="sm" onClick={() => deleteSubcategory(cat.id, sub.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
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
