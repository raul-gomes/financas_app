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
import { Target, PlusCircle, Pencil, Trash2, CheckCircle2, Search, RotateCcw, Save } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { MetasService } from '@/services/goalsService'
import type { Meta } from '@/types/goals'

// ===== Metas Tab =====
export const MetasTab = () => {
    const [metas, setMetas] = useState<Meta[]>([])
    const [loading, setLoading] = useState(false)
    const [formNome, setFormNome] = useState('')
    const [formValor, setFormValor] = useState('')
    const [editingMeta, setEditingMeta] = useState<Meta | null>(null)
    const [editNome, setEditNome] = useState('')
    const [editValor, setEditValor] = useState('')
    const [searchAtivas, setSearchAtivas] = useState('')
    const [searchConcluidas, setSearchConcluidas] = useState('')
    const { toast } = useToast()

    const loadMetas = useCallback(async () => {
        setLoading(true)
        try {
            const data = await MetasService.list()
            setMetas(data)
        } catch {
            toast({ title: 'Erro', description: 'Falha ao carregar metas.', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }, [toast])

    useEffect(() => { loadMetas() }, [loadMetas])

    const handleCreate = async () => {
        if (!formNome.trim() || !formValor) return
        try {
            await MetasService.create({
                subcategoria_nome: formNome.trim(),
                valor_alvo: parseFloat(formValor),
            })
            toast({ title: 'Sucesso', description: 'Meta criada!' })
            setFormNome('')
            setFormValor('')
            loadMetas()
        } catch {
            toast({ title: 'Erro', description: 'Falha ao criar meta.', variant: 'destructive' })
        }
    }

    const handleUpdate = async (id: number) => {
        if (!editNome.trim() || !editValor) return
        try {
            await MetasService.update(id, {
                subcategoria_nome: editNome.trim(),
                valor_alvo: parseFloat(editValor),
            })
            toast({ title: 'Sucesso', description: 'Meta atualizada!' })
            setEditingMeta(null)
            loadMetas()
        } catch {
            toast({ title: 'Erro', description: 'Falha ao atualizar meta.', variant: 'destructive' })
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Excluir esta meta?')) return
        try {
            await MetasService.delete(id)
            toast({ title: 'Sucesso', description: 'Meta excluída!' })
            loadMetas()
        } catch {
            toast({ title: 'Erro', description: 'Falha ao excluir meta.', variant: 'destructive' })
        }
    }

    const handleConcluir = async (id: number) => {
        try {
            await MetasService.concluir(id)
            toast({ title: 'Sucesso', description: 'Meta concluída!' })
            loadMetas()
        } catch {
            toast({ title: 'Erro', description: 'Falha ao concluir meta.', variant: 'destructive' })
        }
    }

    const handleReativar = async (id: number) => {
        try {
            await MetasService.reativar(id)
            toast({ title: 'Sucesso', description: 'Meta reativada!' })
            loadMetas()
        } catch {
            toast({ title: 'Erro', description: 'Falha ao reativar meta.', variant: 'destructive' })
        }
    }

    const startEdit = (meta: Meta) => {
        setEditingMeta(meta)
        setEditNome(meta.subcategoria_nome)
        setEditValor(meta.valor_alvo.toString())
    }

    const ativas = metas.filter(m => !m.concluida)
    const concluidas = metas.filter(m => m.concluida)
    const ativasFiltradas = ativas.filter(m =>
        m.subcategoria_nome.toLowerCase().includes(searchAtivas.toLowerCase())
    )
    const concluidasFiltradas = concluidas.filter(m =>
        m.subcategoria_nome.toLowerCase().includes(searchConcluidas.toLowerCase())
    )

    return (
        <div className="space-y-6">
            {/* Create Form */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        Nova Meta
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-4">
                        <div className="flex-1 space-y-2">
                            <Label>Nome da Meta</Label>
                            <Input
                                placeholder="Ex: Viagem Europa"
                                value={formNome}
                                onChange={e => setFormNome(e.target.value)}
                            />
                        </div>
                        <div className="w-40 space-y-2">
                            <Label>Valor Alvo (R$)</Label>
                            <Input
                                type="number"
                                min="0"
                                step="0.01"
                                placeholder="30000"
                                value={formValor}
                                onChange={e => setFormValor(e.target.value)}
                            />
                        </div>
                        <Button onClick={handleCreate} disabled={!formNome.trim() || !formValor}>
                            <PlusCircle className="h-4 w-4 mr-2" />Criar Meta
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Ativas */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="h-5 w-5 text-primary" />
                        Ativas ({ativas.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar meta ativa..."
                            value={searchAtivas}
                            onChange={e => setSearchAtivas(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2].map(i => (
                                <div key={i} className="animate-pulse h-16 rounded-lg bg-muted" />
                            ))}
                        </div>
                    ) : ativasFiltradas.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4 text-sm">
                            {searchAtivas ? 'Nenhuma meta encontrada.' : 'Nenhuma meta ativa.'}
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {ativasFiltradas.map(meta => (
                                <div key={meta.id} className="border rounded-lg p-4">
                                    {editingMeta?.id === meta.id ? (
                                        <div className="flex items-end gap-3">
                                            <div className="flex-1 space-y-1">
                                                <Label className="text-xs">Nome</Label>
                                                <Input value={editNome} onChange={e => setEditNome(e.target.value)} />
                                            </div>
                                            <div className="w-36 space-y-1">
                                                <Label className="text-xs">Valor Alvo</Label>
                                                <Input type="number" min="0" step="0.01" value={editValor} onChange={e => setEditValor(e.target.value)} />
                                            </div>
                                            <Button size="sm" onClick={() => handleUpdate(meta.id)} disabled={!editNome.trim() || !editValor}>
                                                <Save className="h-3.5 w-3.5 mr-1" />Salvar
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => setEditingMeta(null)}>Cancelar</Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium">{meta.subcategoria_nome}</p>
                                                <p className="text-sm text-muted-foreground">
                                                    R$ {meta.valor_alvo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </p>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="sm" onClick={() => handleConcluir(meta.id)} className="text-green-600 hover:text-green-700">
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => startEdit(meta)}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(meta.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Concluídas */}
            {concluidas.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            Concluídas ({concluidas.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar meta concluída..."
                                value={searchConcluidas}
                                onChange={e => setSearchConcluidas(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="space-y-3">
                            {concluidasFiltradas.length === 0 ? (
                                <p className="text-muted-foreground text-center py-4 text-sm">Nenhuma meta encontrada.</p>
                            ) : (
                                concluidasFiltradas.map(meta => (
                                    <div key={meta.id} className="border border-green-200 rounded-lg p-4 bg-green-50/30">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="font-medium text-green-700">{meta.subcategoria_nome}</p>
                                                <p className="text-sm text-green-600">
                                                    R$ {meta.valor_alvo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                                </p>
                                                {meta.data_conclusao && (
                                                    <p className="text-xs text-muted-foreground mt-0.5">
                                                        Concluída em {new Date(meta.data_conclusao + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="sm" onClick={() => handleReativar(meta.id)} className="text-amber-600 hover:text-amber-700">
                                                    <RotateCcw className="h-4 w-4" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(meta.id)}>
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
