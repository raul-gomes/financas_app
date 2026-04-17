import { useEffect, useState } from 'react'
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { DollarSign, Save, BarChart3, Trash2, PlusCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { FinancialService } from '@/services/financialService'

interface Subcategory {
    subcategoria_nome: string
    id: number | string // string para novos itens temporários
    isNew?: boolean
    isModified?: boolean
}

interface Category {
    categoria_nome: string
    natureza: 'pf' | 'pj' | 'mensal'
    limite: number
    id: number | string // string para novos itens temporários
    subcategorias: Subcategory[]
    isNew?: boolean
    isModified?: boolean
}

type LimitsPayload = Category[]

const Limits = () => {
    const [data, setData] = useState<LimitsPayload>([])
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()

    useEffect(() => {
        setLoading(true)
        FinancialService.getLimits()
            .then(fetched => {
                setData(fetched)
            })
            .catch(err => {
                console.error(err)
                toast({ title: 'Erro', description: 'Não foi possível carregar limites', variant: 'destructive' })
            })
            .finally(() => setLoading(false))
    }, [toast])

    const updateCategoryField = (catId: number | string, key: keyof Category, value: any) => {
        setData(prev =>
            prev.map(cat => {
                if (cat.id === catId) {
                    const updated = { ...cat, [key]: value }
                    // Marca como modificado se não for novo
                    if (!cat.isNew) {
                        updated.isModified = true
                    }
                    return updated
                }
                return cat
            })
        )
    }

    const updateSubcategoryField = (catId: number | string, subId: number | string, value: string) => {
        setData(prev =>
            prev.map(cat => {
                if (cat.id !== catId) return cat

                const updatedCat = {
                    ...cat,
                    subcategorias: cat.subcategorias.map(sub => {
                        if (sub.id === subId) {
                            const updatedSub = { ...sub, subcategoria_nome: value }
                            // Marca como modificado se não for novo
                            if (!sub.isNew) {
                                updatedSub.isModified = true
                            }
                            return updatedSub
                        }
                        return sub
                    })
                }

                // Marca a categoria como modificada se não for nova
                if (!cat.isNew) {
                    updatedCat.isModified = true
                }

                return updatedCat
            })
        )
    }

    const addSubcategory = (catId: number | string) => {
        const tempId = `new_sub_${Date.now()}`
        const newSub: Subcategory = {
            id: tempId,
            subcategoria_nome: '',
            isNew: true
        }

        setData(prev =>
            prev.map(cat => {
                if (cat.id === catId) {
                    const updated = { ...cat, subcategorias: [...cat.subcategorias, newSub] }
                    if (!cat.isNew) {
                        updated.isModified = true
                    }
                    return updated
                }
                return cat
            })
        )
    }

    const deleteSubcategory = (catId: number | string, subId: number | string) => {
        setData(prev =>
            prev.map(cat => {
                if (cat.id === catId) {
                    const updated = {
                        ...cat,
                        subcategorias: cat.subcategorias.filter(sub => sub.id !== subId)
                    }
                    if (!cat.isNew) {
                        updated.isModified = true
                    }
                    return updated
                }
                return cat
            })
        )
    }

    const addCategory = (natureza: 'pf' | 'pj') => {
        const tempId = `new_cat_${Date.now()}`
        const newCategory: Category = {
            id: tempId,
            categoria_nome: '',
            natureza,
            limite: 0,
            subcategorias: [],
            isNew: true
        }
        setData(prev => [...prev, newCategory])
    }

    const deleteCategory = (catId: number | string) => {
        setData(prev => prev.filter(cat => cat.id !== catId))
    }

    // Função para preparar payload de salvamento
    const preparePayloadForSave = () => {
        const payload: any = {
            new: [],
            modified: [],
            deleted: [] // Implementar se necessário
        }

        data.forEach(cat => {
            if (cat.isNew) {
                // Categoria nova - envia sem ID
                const newCat = {
                    categoria_nome: cat.categoria_nome,
                    natureza: cat.natureza,
                    limite: cat.limite,
                    subcategorias: cat.subcategorias
                        .filter(sub => sub.subcategoria_nome.trim()) // Remove vazias
                        .map(sub => ({
                            subcategoria_nome: sub.subcategoria_nome
                        }))
                }
                payload.new.push(newCat)
            } else if (cat.isModified) {
                // Categoria modificada - envia com ID
                const modifiedCat = {
                    id: cat.id,
                    categoria_nome: cat.categoria_nome,
                    natureza: cat.natureza,
                    limite: cat.limite,
                    subcategorias: cat.subcategorias.map(sub => {
                        if (sub.isNew) {
                            // Subcategoria nova dentro de categoria existente
                            return {
                                subcategoria_nome: sub.subcategoria_nome
                            }
                        } else if (sub.isModified) {
                            // Subcategoria modificada
                            return {
                                id: sub.id,
                                subcategoria_nome: sub.subcategoria_nome
                            }
                        } else {
                            // Subcategoria não alterada
                            return {
                                id: sub.id,
                                subcategoria_nome: sub.subcategoria_nome
                            }
                        }
                    }).filter(sub => sub.subcategoria_nome?.trim()) // Remove vazias
                }
                payload.modified.push(modifiedCat)
            }
        })

        return payload
    }

    const handleSave = async () => {
        setLoading(true)
        try {
            const payload = preparePayloadForSave()

            const res = await FinancialService.saveLimits(payload)
            toast({ title: 'Sucesso', description: res.message })
            // Recarrega a lista atualizada
            const refreshed = await FinancialService.getLimits()
            setData(refreshed)

            toast({
                title: 'Sucesso',
                description: 'Limites salvos com sucesso! Verifique o console para ver o payload.'
            })
        } catch (error) {
            console.error('Erro ao salvar:', error)
            toast({
                title: 'Erro',
                description: 'Falha ao salvar limites.',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    // Separando grupos por natureza
    const mensalItem = data.find(cat =>
        cat.categoria_nome.trim().toLowerCase() === 'mensal'
    )
    const pfGroup = data.filter(cat =>
        cat.natureza === 'pf' &&
        cat.categoria_nome.trim().toLowerCase() !== 'mensal'
    )
    const pjGroup = data.filter(cat =>
        cat.natureza === 'pj' &&
        cat.categoria_nome.trim().toLowerCase() !== 'mensal'
    )

    const renderGroup = (
        title: string,
        icon: React.ReactNode,
        categories: Category[],
        natureza?: 'pf' | 'pj',
        showSubcategories: boolean = true,
        allowAddCategory: boolean = true
    ) => (

        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                    {icon}
                    <CardTitle className="text-lg font-semibold m-0">{title}</CardTitle>
                </div>
                {allowAddCategory && natureza && (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => addCategory(natureza)}
                    >
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Nova Categoria
                    </Button>
                )}
            </CardHeader>
            <CardContent className="space-y-6">
                {categories.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                        {allowAddCategory ? 'Nenhuma categoria. Clique em "Nova Categoria" para adicionar.' : 'Nenhuma configuração mensal.'}
                    </p>
                ) : (
                    categories.map(cat => (
                        <div key={cat.id} className="border rounded-lg bg-card p-4 space-y-4 relative">
                            {/* Indicador visual para itens novos/modificados */}
                            {cat.isNew && (
                                <div className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                                    NOVO
                                </div>
                            )}
                            {cat.isModified && !cat.isNew && (
                                <div className="absolute -top-2 -right-2 bg-yellow-500 text-white text-xs px-2 py-1 rounded-full">
                                    MODIFICADO
                                </div>
                            )}

                            <div className="flex items-end gap-4">
                                <div className="flex-1">
                                    <Label>Categoria</Label>
                                    <Input
                                        type="text"
                                        value={cat.categoria_nome}
                                        placeholder="Nome da categoria"
                                        onChange={e => updateCategoryField(cat.id, 'categoria_nome', e.target.value)}
                                    />
                                </div>
                                <div className="w-32">
                                    <Label>Limite (R$)</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={cat.limite}
                                        onChange={e =>
                                            updateCategoryField(cat.id, 'limite', parseFloat(e.target.value) || 0)
                                        }
                                    />
                                </div>
                                {natureza && ( // Só mostra botão de excluir se não for mensal
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => deleteCategory(cat.id)}
                                        className="text-destructive hover:text-destructive"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                )}
                            </div>

                            {/* Subcategorias - só aparece se showSubcategories for true */}
                            {showSubcategories && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="font-medium text-sm">Subcategorias</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => addSubcategory(cat.id)}
                                        >
                                            <PlusCircle className="h-4 w-4 mr-1" />
                                            Adicionar
                                        </Button>
                                    </div>

                                    {cat.subcategorias.length === 0 ? (
                                        <p className="text-muted-foreground text-sm text-center py-2">
                                            Nenhuma subcategoria
                                        </p>
                                    ) : (
                                        <div className="space-y-2">
                                            {cat.subcategorias.map(sub => (
                                                <div key={sub.id} className="flex items-center gap-2 relative">
                                                    {/* Indicador visual para subcategorias novas/modificadas */}
                                                    {sub.isNew && (
                                                        <div className="absolute -top-2 -right-2 bg-green-400 text-white text-xs px-1 py-0.5 rounded text-[10px] z-10">
                                                            NOVO
                                                        </div>
                                                    )}
                                                    {sub.isModified && !sub.isNew && (
                                                        <div className="absolute -top-2 -right-2 bg-yellow-400 text-white text-xs px-1 py-0.5 rounded text-[10px] z-10">
                                                            MOD
                                                        </div>
                                                    )}
                                                    <Input
                                                        type="text"
                                                        value={sub.subcategoria_nome}
                                                        placeholder="Nome da subcategoria"
                                                        onChange={e =>
                                                            updateSubcategoryField(cat.id, sub.id, e.target.value)
                                                        }
                                                        className="flex-1"
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => deleteSubcategory(cat.id, sub.id)}
                                                        className="text-destructive hover:text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </CardContent>
        </Card>
    )

    return (
        <div className="min-h-screen bg-gradient-subtle p-6 space-y-8">
            <div className="max-w-6xl mx-auto">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold">Gerenciar Limites</h1>
                    <p className="text-muted-foreground">
                        Configure os limites de gastos para suas categorias e subcategorias
                    </p>
                </div>

                <div className="grid gap-8">
                    {/* Limite Mensal - Especial */}
                    {mensalItem && (
                        <Card>
                            <CardHeader className="flex items-center gap-2 flex-row">
                                <DollarSign className="text-primary" />
                                <CardTitle>Limite Mensal</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className='flex flex-row gap-2 items-center'>
                                <Label>Limite</Label>
                                <Input
                                    type="number"
                                    value={mensalItem.limite}
                                    onChange={e =>
                                        updateCategoryField(mensalItem.id, 'limite', parseFloat(e.target.value))
                                    }
                                />
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Categorias PF */}
                    {renderGroup(
                        'Categorias Pessoa Física',
                        <BarChart3 className="h-5 w-5 text-primary" />,
                        pfGroup,
                        'pf'
                    )}

                    {/* Categorias PJ */}
                    {renderGroup(
                        'Categorias Pessoa Jurídica',
                        <DollarSign className="h-5 w-5 text-primary" />,
                        pjGroup,
                        'pj'
                    )}
                </div>

                <div className="flex justify-end mt-8">
                    <Button
                        onClick={handleSave}
                        disabled={loading}
                        className="flex items-center gap-2"
                        size="lg"
                    >
                        <Save className="h-4 w-4" />
                        {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                </div>
            </div>
        </div>
    )
}

export default Limits
