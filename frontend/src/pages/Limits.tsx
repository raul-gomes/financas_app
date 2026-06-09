import { useEffect, useState, useCallback } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { DollarSign, Save, BarChart3, Trash2, PlusCircle, Pencil, ToggleLeft, ToggleRight, CreditCard, AlertTriangle, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { FinancialService } from '@/services/financialService'
import { ContaRecorrenteService } from '@/services/contaRecorrenteService'
import { ContaRecorrente, ContaRecorrenteCreate, ContaRecorrenteUpdate } from '@/types/conta_recorrente'
import { CategorySubcategories } from '@/types/financial'

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
const LimitsTab = () => {
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

    const deleteCategory = (catId: number | string) => {
        setData(prev => prev.filter(cat => cat.id !== catId))
    }

    const preparePayloadForSave = () => {
        const payload: any = { new: [], modified: [], deleted: [] }
        data.forEach(cat => {
            if (cat.isNew) {
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

// ===== Recorrentes Tab =====
const RecorrentesTab = () => {
    const [contas, setContas] = useState<ContaRecorrente[]>([])
    const [showForm, setShowForm] = useState(false)
    const [editingConta, setEditingConta] = useState<ContaRecorrente | null>(null)
    const [renewingId, setRenewingId] = useState<number | null>(null)
    const { toast } = useToast()

    const loadContas = useCallback(async () => {
        try { setContas(await ContaRecorrenteService.getAll()) } catch {
            toast({ title: 'Erro', description: 'Falha ao carregar contas recorrentes.', variant: 'destructive' })
        }
    }, [toast])

    useEffect(() => {
        loadContas()
    }, [loadContas])

    const handleCreate = async (payload: ContaRecorrenteCreate) => {
        try {
            await ContaRecorrenteService.create(payload)
            toast({ title: 'Sucesso', description: 'Conta recorrente criada com 12 parcelas!' })
            setShowForm(false)
            loadContas()
        } catch {
            toast({ title: 'Erro', description: 'Falha ao criar.', variant: 'destructive' })
        }
    }

    const handleUpdate = async (id: number, payload: ContaRecorrenteUpdate) => {
        try {
            await ContaRecorrenteService.update(id, payload)
            toast({ title: 'Sucesso', description: 'Conta recorrente atualizada!' })
            setEditingConta(null)
            loadContas()
        } catch {
            toast({ title: 'Erro', description: 'Falha ao atualizar.', variant: 'destructive' })
        }
    }

    const handleToggleActive = async (conta: ContaRecorrente) => {
        const msg = conta.ativo
            ? `Isso cancelara as ${conta.parcelas_restantes} parcelas futuras. Desativar mesmo?`
            : 'Ativar esta conta recorrente?'
        if (!confirm(msg)) return
        try {
            await ContaRecorrenteService.update(conta.id, { ativo: !conta.ativo })
            toast({
                title: 'Sucesso',
                description: conta.ativo
                    ? `Conta desativada. ${conta.parcelas_restantes} parcelas futuras canceladas.`
                    : 'Conta ativada.',
            })
            loadContas()
        } catch {
            toast({ title: 'Erro', description: 'Falha ao alterar status.', variant: 'destructive' })
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir?')) return
        try { await ContaRecorrenteService.delete(id); toast({ title: 'Sucesso', description: 'Conta excluida!' }); loadContas() } catch {
            toast({ title: 'Erro', description: 'Falha ao excluir.', variant: 'destructive' })
        }
    }

    const handleRenew = async (id: number) => {
        setRenewingId(id)
        try {
            await ContaRecorrenteService.renew(id)
            toast({ title: 'Sucesso', description: 'Conta renovada por mais 12 meses!' })
            loadContas()
        } catch {
            toast({ title: 'Erro', description: 'Falha ao renovar.', variant: 'destructive' })
        } finally {
            setRenewingId(null)
        }
    }

    const isEndingSoon = (conta: ContaRecorrente): boolean =>
        conta.ativo && conta.parcelas_restantes <= 2 && conta.parcelas_restantes > 0

    const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
    const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold">Contas Recorrentes</h2>
                    <p className="text-muted-foreground text-sm">Gerencie suas despesas mensais fixas — cada conta gera 12 parcelas</p>
                </div>
                <Button onClick={() => setShowForm(true)} className="bg-gradient-primary">
                    <PlusCircle className="w-4 h-4 mr-2" />Nova Conta Recorrente
                </Button>
            </div>

            {contas.length === 0 ? (
                <div className="p-12 text-center bg-card rounded-lg border border-border">
                    <p className="text-muted-foreground">Nenhuma conta recorrente cadastrada.</p>
                </div>
            ) : (
                <div className="bg-card rounded-lg border border-border overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-muted/50 border-b border-border">
                            <tr>
                                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Descricao</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Valor</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Vencimento</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Categoria</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Parcelas</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Acoes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {contas.map(conta => (
                                <tr key={conta.id} className={`hover:bg-muted/30 ${!conta.ativo ? 'opacity-50' : ''}`}>
                                    <td className="px-4 py-3 text-sm font-medium">
                                        <div className="flex items-center gap-2">
                                            {conta.descricao}
                                            {isEndingSoon(conta) && (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Acabando
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-sm">{formatCurrency(conta.valor)}</td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">Dia {conta.dia_vencimento}</td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">
                                        {conta.categoria_nome}{conta.subcategoria_nome && ` / ${conta.subcategoria_nome}`}
                                    </td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">
                                        {conta.parcelas_restantes}/{conta.total_parcelas}
                                    </td>
                                    <td className="px-4 py-3">
                                        <button onClick={() => handleToggleActive(conta)} className="flex items-center gap-1 text-sm">
                                            {conta.ativo ? (
                                                <ToggleRight className="w-5 h-5 text-green-500" />
                                            ) : (
                                                <ToggleLeft className="w-5 h-5 text-muted-foreground" />
                                            )}
                                            <span className={`text-xs ${conta.ativo ? 'text-green-500' : 'text-muted-foreground'}`}>
                                                {conta.ativo ? 'Ativa' : 'Inativa'}
                                            </span>
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-1">
                                            <Button variant="ghost" size="sm" onClick={() => setEditingConta(conta)}>
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRenew(conta.id)}
                                                disabled={renewingId === conta.id || (conta.ativo && conta.parcelas_restantes > 2)}
                                                title={
                                                    conta.ativo && conta.parcelas_restantes > 2
                                                        ? 'Ainda ha parcelas restantes'
                                                        : 'Renovar por mais 12 meses'
                                                }
                                            >
                                                <RefreshCw className={`w-4 h-4 ${renewingId === conta.id ? 'animate-spin' : ''}`} />
                                            </Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(conta.id)}>
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {(showForm || editingConta) && (
                <ContaForm
                    conta={editingConta}
                    onClose={() => { setShowForm(false); setEditingConta(null) }}
                    onSubmit={(payload) => editingConta ? handleUpdate(editingConta.id, payload) : handleCreate(payload as ContaRecorrenteCreate)}
                />
            )}
        </div>
    )
}

// ===== Shared Form =====
const ContaForm = ({ conta, onClose, onSubmit }: {
    conta: ContaRecorrente | null
    onClose: () => void
    onSubmit: (payload: ContaRecorrenteCreate | ContaRecorrenteUpdate) => void
}) => {
    const [form, setForm] = useState({
        descricao: conta?.descricao || '',
        valor: conta?.valor?.toString() || '',
        dia_vencimento: conta?.dia_vencimento?.toString() || '1',
        natureza: conta?.natureza || 'pf' as 'pf' | 'pj',
        forma_pagamento: conta?.forma_pagamento || 'pix',
        data_inicio: conta?.data_inicio?.split('T')[0] || new Date().toISOString().split('T')[0],
        data_fim: conta?.data_fim?.split('T')[0] || '',
        categoria: conta?.categoria_nome || '',
        subcategoria: conta?.subcategoria_nome || '',
    })
    const [newCategory, setNewCategory] = useState('')
    const [newSubcategory, setNewSubcategory] = useState('')
    const [showNewCategoryInput, setShowNewCategoryInput] = useState(false)
    const [showNewSubcategoryInput, setShowNewSubcategoryInput] = useState(false)
    const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories | null>(null)

    useEffect(() => {
        FinancialService.getCategorySubcategories(form.natureza, 'saida')
            .then(options => setCategoryOptions(options))
            .catch(() => {})
    }, [form.natureza])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!form.descricao || !form.valor) return

        const payload: any = {
            descricao: form.descricao,
            valor: parseFloat(form.valor),
            dia_vencimento: parseInt(form.dia_vencimento),
            natureza: form.natureza,
            forma_pagamento: form.forma_pagamento,
            data_inicio: form.data_inicio,
            data_fim: form.data_fim || undefined,
        }

        if (form.categoria && form.subcategoria) {
            const catObj = categoryOptions?.opcoes.find(c => c.categoria === form.categoria)
            const subObj = catObj?.subcategorias.find(s => s.nome === form.subcategoria)
            if (catObj && subObj) {
                payload.categoria_id = catObj.id
                payload.subcategoria_id = subObj.id
            } else {
                payload.categoria_nome = form.categoria
                payload.subcategoria_nome = form.subcategoria
            }
        }
        onSubmit(payload)
    }

    return (
        <Card className="border border-border">
            <CardHeader><CardTitle>{conta ? 'Editar Conta Recorrente' : 'Nova Conta Recorrente'}</CardTitle></CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Descricao</Label><Input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} required /></div>
                    <div className="space-y-2"><Label>Valor</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} required /></div>
                    <div className="space-y-2"><Label>Dia Vencimento</Label><Input type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm({...form, dia_vencimento: e.target.value})} required /></div>
                    <div className="space-y-2">
                        <Label>Natureza</Label>
                        <Select value={form.natureza} onValueChange={v => {
                            setForm({...form, natureza: v as 'pf'|'pj', categoria: '', subcategoria: ''})
                            setShowNewCategoryInput(false)
                            setShowNewSubcategoryInput(false)
                        }}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent><SelectItem value="pf">Pessoa Fisica</SelectItem><SelectItem value="pj">Pessoa Juridica</SelectItem></SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label>Forma Pagamento</Label>
                        <Select value={form.forma_pagamento} onValueChange={v => setForm({...form, forma_pagamento: v})}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="pix">PIX</SelectItem><SelectItem value="debito">Debito</SelectItem><SelectItem value="credito">Credito</SelectItem>
                                <SelectItem value="boleto">Boleto</SelectItem><SelectItem value="transferencia">Transferencia</SelectItem><SelectItem value="dinheiro">Dinheiro</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2"><Label>Data Inicio</Label><Input type="date" value={form.data_inicio} onChange={e => setForm({...form, data_inicio: e.target.value})} required /></div>
                    <div className="space-y-2"><Label>Data Fim (opcional)</Label><Input type="date" value={form.data_fim} onChange={e => setForm({...form, data_fim: e.target.value})} /></div>
                    <div className="space-y-2">
                        <Label>Categoria</Label>
                        <Select value={showNewCategoryInput ? 'outros' : form.categoria} onValueChange={v => {
                            if (v === 'outros') {
                                setShowNewCategoryInput(true)
                                setForm({...form, categoria: '', subcategoria: ''})
                            } else {
                                setShowNewCategoryInput(false)
                                setNewCategory('')
                                setForm({...form, categoria: v, subcategoria: ''})
                            }
                        }}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>
                                {categoryOptions?.opcoes.map(c => <SelectItem key={c.id} value={c.categoria}>{c.categoria}</SelectItem>)}
                                <SelectItem value="outros">Outros</SelectItem>
                            </SelectContent>
                        </Select>
                        {showNewCategoryInput && (
                            <div className="space-y-2 mt-2">
                                <Label>Nova Categoria</Label>
                                <Input placeholder="Digite a nova categoria" value={newCategory} onChange={e => {
                                    setNewCategory(e.target.value)
                                    setForm({...form, categoria: e.target.value.trim(), subcategoria: ''})
                                }} />
                            </div>
                        )}
                    </div>
                    {form.categoria && (
                        <div className="space-y-2">
                            <Label>Subcategoria</Label>
                            <Select value={showNewSubcategoryInput ? 'outros' : form.subcategoria} onValueChange={v => {
                                if (v === 'outros') {
                                    setShowNewSubcategoryInput(true)
                                    setForm({...form, subcategoria: ''})
                                } else {
                                    setShowNewSubcategoryInput(false)
                                    setNewSubcategory('')
                                    setForm({...form, subcategoria: v})
                                }
                            }}>
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>
                                    {categoryOptions?.opcoes.find(c => c.categoria === form.categoria)?.subcategorias.map(s => (
                                        <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>
                                    ))}
                                    <SelectItem value="outros">Outros</SelectItem>
                                </SelectContent>
                            </Select>
                            {showNewSubcategoryInput && (
                                <div className="space-y-2 mt-2">
                                    <Label>Nova Subcategoria</Label>
                                    <Input placeholder="Digite a nova subcategoria" value={newSubcategory} onChange={e => {
                                        setNewSubcategory(e.target.value)
                                        setForm({...form, subcategoria: e.target.value.trim()})
                                    }} />
                                </div>
                            )}
                        </div>
                    )}
                    <div className="col-span-2 flex gap-2">
                        <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
                        <Button type="submit" className="flex-1 bg-gradient-primary">{conta ? 'Salvar' : 'Criar'}</Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}

// ===== Main Page =====
const Limits = () => (
    <div className="min-h-screen bg-gradient-subtle px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div className="max-w-6xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold">Configurações</h1>
                <p className="text-muted-foreground">Gerencie limites e contas recorrentes</p>
            </div>
            <Tabs defaultValue="limits" className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-8">
                    <TabsTrigger value="limits">Limites</TabsTrigger>
                    <TabsTrigger value="recorrentes">Contas Recorrentes</TabsTrigger>
                </TabsList>
                <TabsContent value="limits"><LimitsTab /></TabsContent>
                <TabsContent value="recorrentes"><RecorrentesTab /></TabsContent>
            </Tabs>
        </div>
    </div>
)

export default Limits
