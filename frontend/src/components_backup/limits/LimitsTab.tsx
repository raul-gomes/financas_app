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
    subcategoria_nome: string
    id: number | string
    isNew?: boolean
    isModified?: boolean
}

interface Category {
    categoria_nome: string
    natureza: 'pf' | 'pj' | 'mensal'
    limite: number
    id: number | string
    subcategorias: Subcategory[]
    tipo?: string | null
    isNew?: boolean
    isModified?: boolean
}

// ===== Limits Tab =====
export const LimitsTab = () => {
    const [data, setData] = useState<Category[]>([])
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()

    useEffect(() => {
        setLoading(true)
        FinancialService.getLimits()
            .then(fetched => {
                const ensureCategory = (name: string, natureza: 'pf' | 'pj', defaultLimit: number): Category => {
                    const existing = fetched.find(c => c.categoria_nome.trim().toLowerCase() === name.toLowerCase());
                    if (existing) return existing;
                    return {
                        id: `new_${name.replace(/\s+/g, '_').toLowerCase()}_${Date.now()}`,
                        categoria_nome: name,
                        natureza,
                        limite: defaultLimit,
                        subcategorias: [],
                        isNew: true,
                    };
                };

                const mensalPF = ensureCategory('Mensal PF', 'pf', 1000);
                const mensalPJ = ensureCategory('Mensal PJ', 'pj', 1000);
                const limiteCartao = ensureCategory('Limite Cartao Credito', 'pf', 5000);

                // Remove the special categories from the regular lists
                const specialNames = ['mensal pf', 'mensal pj', 'limite cartao credito', 'mensal'];
                const rest = fetched.filter(c => !specialNames.includes(c.categoria_nome.trim().toLowerCase()));

                setData([mensalPF, mensalPJ, limiteCartao, ...rest]);
            })
            .catch(err => {
                console.error(err)
                toast({ title: 'Erro', description: 'Nao foi possivel carregar limites', variant: 'destructive' })
            })
            .finally(() => setLoading(false))
    }, [toast])

    const updateCategoryField = (catId: number | string, key: keyof Category, value: any) => {
        setData(prev => prev.map(cat => cat.id === catId ? { ...{ ...cat, [key]: value }, isModified: !cat.isNew && cat.isModified !== false ? true : cat.isModified } : cat))
    }

    const updateSubcategoryField = (catId: number | string, subId: number | string, value: string) => {
        setData(prev => prev.map(cat => {
            if (cat.id !== catId) return cat
            return { ...cat, subcategorias: cat.subcategorias.map(sub => sub.id === subId ? { ...sub, subcategoria_nome: value, isModified: !sub.isNew } : sub), isModified: !cat.isNew }
        }))
    }

    const addSubcategory = (catId: number | string) => {
        setData(prev => prev.map(cat => cat.id === catId ? { ...cat, subcategorias: [...cat.subcategorias, { id: `new_sub_${Date.now()}`, subcategoria_nome: '', isNew: true }], isModified: !cat.isNew } : cat))
    }

    const deleteSubcategory = (catId: number | string, subId: number | string) => {
        setData(prev => prev.map(cat => cat.id === catId ? { ...cat, subcategorias: cat.subcategorias.filter(s => s.id !== subId), isModified: !cat.isNew } : cat))
    }

    const addCategory = (natureza: 'pf' | 'pj') => {
        setData(prev => [...prev, { id: `new_cat_${Date.now()}`, categoria_nome: '', natureza, limite: 0, subcategorias: [], isNew: true }])
    }

    const [deletedCategoryIds, setDeletedCategoryIds] = useState<number[]>([])

    const deleteCategory = (catId: number | string) => {
        // Track real IDs for backend deletion
        if (typeof catId === 'number') {
            setDeletedCategoryIds(prev => [...prev, catId])
        }
        setData(prev => prev.filter(cat => cat.id !== catId))
    }

    const preparePayloadForSave = () => {
        const existingNames = new Set(data.map(c => c.categoria_nome.trim().toLowerCase()))
        const payload: any = { new: [], modified: [], deleted: deletedCategoryIds }
        data.forEach(cat => {
            if (cat.isNew) {
                // Skip if a category with this name already exists (prevents duplicates)
                if (existingNames.has(cat.categoria_nome.trim().toLowerCase())) {
                    return
                }
                payload.new.push({
                    categoria_nome: cat.categoria_nome,
                    natureza: cat.natureza,
                    limite: cat.limite,
                    subcategorias: cat.subcategorias.filter(s => s.subcategoria_nome.trim()).map(s => ({ subcategoria_nome: s.subcategoria_nome }))
                })
            } else if (cat.isModified) {
                payload.modified.push({
                    id: cat.id,
                    categoria_nome: cat.categoria_nome,
                    natureza: cat.natureza,
                    limite: cat.limite,
                    subcategorias: cat.subcategorias.map(sub => ({
                        ...(sub.isNew ? {} : { id: sub.id }),
                        subcategoria_nome: sub.subcategoria_nome
                    })).filter(s => s.subcategoria_nome?.trim())
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
            setData(refreshed)
            setDeletedCategoryIds([])
        } catch {
            toast({ title: 'Erro', description: 'Falha ao salvar limites.', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }

    const mensalPFItem = data.find(cat => cat.categoria_nome.trim().toLowerCase() === 'mensal pf');
    const mensalPJItem = data.find(cat => cat.categoria_nome.trim().toLowerCase() === 'mensal pj');
    const limiteCartaoItem = data.find(cat => cat.categoria_nome.trim().toLowerCase() === 'limite cartao credito');
    const specialNames = ['mensal pf', 'mensal pj', 'limite cartao credito', 'mensal'];
    // Filtra categorias que não têm limite (entrada/investimento não possuem limite)
    const hasLimit = (c: Category) => !c.tipo || c.tipo === 'saida';
    const pfGroup = data.filter(cat => cat.natureza === 'pf' && !specialNames.includes(cat.categoria_nome.trim().toLowerCase()) && hasLimit(cat));
    const pjGroup = data.filter(cat => cat.natureza === 'pj' && !specialNames.includes(cat.categoria_nome.trim().toLowerCase()) && hasLimit(cat));

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
                                    <Input value={cat.categoria_nome} placeholder="Nome da categoria" onChange={e => updateCategoryField(cat.id, 'categoria_nome', e.target.value)} />
                                </div>
                                <div className="w-32">
                                    <Label>Limite (R$)</Label>
                                    <Input type="number" min="0" step="0.01" value={cat.limite} onChange={e => updateCategoryField(cat.id, 'limite', parseFloat(e.target.value) || 0)} />
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => deleteCategory(cat.id)} className="text-destructive hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </div>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">Subcategorias</span>
                                    <Button variant="ghost" size="sm" onClick={() => addSubcategory(cat.id)}><PlusCircle className="h-4 w-4 mr-1" />Adicionar</Button>
                                </div>
                                {cat.subcategorias.length === 0 ? (
                                    <p className="text-muted-foreground text-sm text-center py-2">Nenhuma subcategoria</p>
                                ) : (
                                    <div className="space-y-2">
                                        {cat.subcategorias.map(sub => (
                                            <div key={sub.id} className="flex items-center gap-2 relative">
                                                {sub.isNew && (<div className="absolute -top-2 -right-2 bg-green-400 text-white text-xs px-1 py-0.5 rounded text-[10px] z-10">NOVO</div>)}
                                                {sub.isModified && !sub.isNew && (<div className="absolute -top-2 -right-2 bg-yellow-400 text-white text-xs px-1 py-0.5 rounded text-[10px] z-10">MOD</div>)}
                                                <Input value={sub.subcategoria_nome} placeholder="Nome da subcategoria" onChange={e => updateSubcategoryField(cat.id, sub.id, e.target.value)} className="flex-1" />
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
                {/* Limite Mensal PF */}
                <Card className="border-primary/50 shadow-md">
                    <CardHeader className="flex items-center gap-2 flex-row pb-2">
                        <div className="bg-primary/10 p-2 rounded-full"><DollarSign className="text-primary h-6 w-6" /></div>
                        <div><CardTitle className="text-lg">Limite Mensal PF</CardTitle><p className="text-sm text-muted-foreground">Orçamento mensal Pessoa Física</p></div>
                    </CardHeader>
                    <CardContent>
                        <div className="relative max-w-[200px]">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                            <Input type="number" className="pl-9 text-lg font-semibold" value={mensalPFItem?.limite || 0} onChange={e => { if (mensalPFItem) updateCategoryField(mensalPFItem.id, 'limite', parseFloat(e.target.value) || 0) }} />
                        </div>
                    </CardContent>
                </Card>

                {/* Limite Mensal PJ */}
                <Card className="border-primary/50 shadow-md">
                    <CardHeader className="flex items-center gap-2 flex-row pb-2">
                        <div className="bg-primary/10 p-2 rounded-full"><DollarSign className="text-primary h-6 w-6" /></div>
                        <div><CardTitle className="text-lg">Limite Mensal PJ</CardTitle><p className="text-sm text-muted-foreground">Orçamento mensal Pessoa Jurídica</p></div>
                    </CardHeader>
                    <CardContent>
                        <div className="relative max-w-[200px]">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                            <Input type="number" className="pl-9 text-lg font-semibold" value={mensalPJItem?.limite || 0} onChange={e => { if (mensalPJItem) updateCategoryField(mensalPJItem.id, 'limite', parseFloat(e.target.value) || 0) }} />
                        </div>
                    </CardContent>
                </Card>

                {/* Limite Cartão de Crédito */}
                <Card className="border-primary/50 shadow-md">
                    <CardHeader className="flex items-center gap-2 flex-row pb-2">
                        <div className="bg-primary/10 p-2 rounded-full"><CreditCard className="text-primary h-6 w-6" /></div>
                        <div><CardTitle className="text-lg">Limite Cartão de Crédito</CardTitle><p className="text-sm text-muted-foreground">Limite total do cartão</p></div>
                    </CardHeader>
                    <CardContent>
                        <div className="relative max-w-[200px]">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                            <Input type="number" className="pl-9 text-lg font-semibold" value={limiteCartaoItem?.limite || 0} onChange={e => { if (limiteCartaoItem) updateCategoryField(limiteCartaoItem.id, 'limite', parseFloat(e.target.value) || 0) }} />
                        </div>
                    </CardContent>
                </Card>
            </div>
            {renderGroup('Categorias Pessoa Física', <BarChart3 className="h-5 w-5 text-primary" />, pfGroup, 'pf')}
            {renderGroup('Categorias Pessoa Jurídica', <DollarSign className="h-5 w-5 text-primary" />, pjGroup, 'pj')}
            <div className="flex justify-end">
                <Button onClick={handleSave} disabled={loading} className="flex items-center gap-2" size="lg">
                    <Save className="h-4 w-4" />{loading ? 'Salvando...' : 'Salvar Alterações'}
                </Button>
            </div>
        </div>
    )
}
