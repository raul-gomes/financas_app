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
import { DollarSign, Save, BarChart3, Trash2, PlusCircle, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
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
                const hasMensal = fetched.some(c => c.categoria_nome.toLowerCase() === 'mensal');
                if (!hasMensal) {
                    setData([{
                        id: `new_mensal_${Date.now()}`,
                        categoria_nome: 'Mensal',
                        natureza: 'pf',
                        limite: 1000,
                        subcategorias: [],
                        isNew: true
                    }, ...fetched]);
                } else {
                    setData(fetched);
                }
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

    const mensalItem = data.find(cat => cat.categoria_nome.trim().toLowerCase() === 'mensal')
    const pfGroup = data.filter(cat => cat.natureza === 'pf' && cat.categoria_nome.trim().toLowerCase() !== 'mensal')
    const pjGroup = data.filter(cat => cat.natureza === 'pj' && cat.categoria_nome.trim().toLowerCase() !== 'mensal')

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
            <Card className="border-primary/50 shadow-md">
                <CardHeader className="flex items-center gap-2 flex-row pb-2">
                    <div className="bg-primary/10 p-2 rounded-full"><DollarSign className="text-primary h-6 w-6" /></div>
                    <div><CardTitle className="text-xl">Limite Mensal Global</CardTitle><p className="text-sm text-muted-foreground">Orçamento total planejado para o mês</p></div>
                </CardHeader>
                <CardContent>
                    <div className='flex flex-row gap-4 items-center'>
                        <div className="relative flex-1 max-w-[200px]">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">R$</span>
                            <Input type="number" className="pl-9 text-lg font-semibold" value={mensalItem?.limite || 0} onChange={e => { if (mensalItem) updateCategoryField(mensalItem.id, 'limite', parseFloat(e.target.value) || 0) }} />
                        </div>
                        <p className="text-sm text-muted-foreground">Este valor será usado como referência nos gráficos do dashboard.</p>
                    </div>
                </CardContent>
            </Card>
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
    const [categoryOptions, setCategoryOptions] = useState<CategorySubcategories | null>(null)
    const [showForm, setShowForm] = useState(false)
    const [editingConta, setEditingConta] = useState<ContaRecorrente | null>(null)
    const { toast } = useToast()

    const loadContas = useCallback(async () => {
        try { setContas(await ContaRecorrenteService.getAll()) } catch {
            toast({ title: 'Erro', description: 'Falha ao carregar contas recorrentes.', variant: 'destructive' })
        }
    }, [toast])

    useEffect(() => {
        loadContas()
        FinancialService.getCategorySubcategories('all').then(setCategoryOptions).catch(() => {})
    }, [loadContas])

    const handleCreate = async (payload: ContaRecorrenteCreate) => {
        try {
            await ContaRecorrenteService.create(payload)
            toast({ title: 'Sucesso', description: 'Conta recorrente criada!' })
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

    const handleDelete = async (id: number) => {
        if (!confirm('Tem certeza que deseja excluir?')) return
        try { await ContaRecorrenteService.delete(id); toast({ title: 'Sucesso', description: 'Conta excluida!' }); loadContas() } catch {
            toast({ title: 'Erro', description: 'Falha ao excluir.', variant: 'destructive' })
        }
    }

    const formatCurrency = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
    const formatDate = (d: string) => new Date(d).toLocaleDateString('pt-BR')

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold">Contas Recorrentes</h2>
                    <p className="text-muted-foreground text-sm">Gerencie suas despesas mensais fixas</p>
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
                <div className="bg-card rounded-lg border border-border overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-muted/50 border-b border-border">
                            <tr>
                                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Descricao</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Valor</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Vencimento</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Categoria</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Inicio</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Status</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Acoes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {contas.map(conta => (
                                <tr key={conta.id} className={`hover:bg-muted/30 ${!conta.ativo ? 'opacity-50' : ''}`}>
                                    <td className="px-4 py-3 text-sm font-medium">{conta.descricao}</td>
                                    <td className="px-4 py-3 text-sm">{formatCurrency(conta.valor)}</td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">Dia {conta.dia_vencimento}</td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">{conta.categoria_nome}{conta.subcategoria_nome && ` / ${conta.subcategoria_nome}`}</td>
                                    <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(conta.data_inicio)}</td>
                                    <td className="px-4 py-3">
                                        <button onClick={async () => { try { await ContaRecorrenteService.update(conta.id, { ativo: !conta.ativo }); loadContas() } catch {} }}>
                                            {conta.ativo ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
                                            <span className={`text-xs ${conta.ativo ? 'text-green-500' : 'text-muted-foreground'}`}>{conta.ativo ? 'Ativa' : 'Inativa'}</span>
                                        </button>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => setEditingConta(conta)}><Pencil className="w-4 h-4" /></Button>
                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(conta.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
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
                    categoryOptions={categoryOptions}
                    onClose={() => { setShowForm(false); setEditingConta(null) }}
                    onSubmit={(payload) => editingConta ? handleUpdate(editingConta.id, payload) : handleCreate(payload as ContaRecorrenteCreate)}
                />
            )}
        </div>
    )
}

// ===== Shared Form =====
const ContaForm = ({ conta, categoryOptions, onClose, onSubmit }: {
    conta: ContaRecorrente | null
    categoryOptions: CategorySubcategories | null
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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const catObj = categoryOptions?.opcoes.find(c => c.categoria === form.categoria)
        const subObj = catObj?.subcategorias.find(s => s.nome === form.subcategoria)
        if (!catObj || !subObj) return

        const payload: any = {
            descricao: form.descricao,
            valor: parseFloat(form.valor),
            dia_vencimento: parseInt(form.dia_vencimento),
            natureza: form.natureza,
            forma_pagamento: form.forma_pagamento,
            data_inicio: form.data_inicio,
            data_fim: form.data_fim || undefined,
            categoria_id: catObj.id,
            subcategoria_id: subObj.id,
        }
        onSubmit(payload)
    }

    return (
        <Card className="border border-border">
            <CardHeader><CardTitle>{conta ? 'Editar Conta Recorrente' : 'Nova Conta Recorrente'}</CardTitle></CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><Label>Descricao</Label><Input value={form.descricao} onChange={e => setForm({...form, descricao: e.target.value})} required /></div>
                    <div className="space-y-2"><Label>Valor</Label><Input type="number" step="0.01" value={form.valor} onChange={e => setForm({...form, valor: e.target.value})} required /></div>
                    <div className="space-y-2"><Label>Dia Vencimento</Label><Input type="number" min="1" max="31" value={form.dia_vencimento} onChange={e => setForm({...form, dia_vencimento: e.target.value})} required /></div>
                    <div className="space-y-2">
                        <Label>Natureza</Label>
                        <Select value={form.natureza} onValueChange={v => setForm({...form, natureza: v as 'pf'|'pj'})}>
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
                        <Select value={form.categoria} onValueChange={v => setForm({...form, categoria: v, subcategoria: ''})}>
                            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                            <SelectContent>{categoryOptions?.opcoes.map(c => <SelectItem key={c.id} value={c.categoria}>{c.categoria}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    {form.categoria && (
                        <div className="space-y-2">
                            <Label>Subcategoria</Label>
                            <Select value={form.subcategoria} onValueChange={v => setForm({...form, subcategoria: v})}>
                                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                                <SelectContent>{categoryOptions?.opcoes.find(c => c.categoria === form.categoria)?.subcategorias.map(s => <SelectItem key={s.id} value={s.nome}>{s.nome}</SelectItem>)}</SelectContent>
                            </Select>
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
    <div className="min-h-screen bg-gradient-subtle p-6 space-y-8">
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
