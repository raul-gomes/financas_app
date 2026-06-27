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
import { ShoppingCart, PlusCircle, Pencil, Trash2, CheckCircle2, Search, Save } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ShoppingService } from '@/services/shoppingService'
import type { ShoppingItem } from '@/types/shopping'

// ===== Compras Tab =====
export const ComprasTab = () => {
    const [items, setItems] = useState<ShoppingItem[]>([])
    const [loading, setLoading] = useState(false)
    const [newNome, setNewNome] = useState('')
    const [editingItem, setEditingItem] = useState<ShoppingItem | null>(null)
    const [editNome, setEditNome] = useState('')
    const [searchPendentes, setSearchPendentes] = useState('')
    const [searchConcluidas, setSearchConcluidas] = useState('')
    const { toast } = useToast()
    const mesRef = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const mesRefStr = mesRef.toISOString().slice(0, 10)

    const loadItems = useCallback(async () => {
        setLoading(true)
        try {
            const data = await ShoppingService.listByMonth(mesRefStr)
            setItems(data)
        } catch {
            toast({ title: 'Erro', description: 'Falha ao carregar compras.', variant: 'destructive' })
        } finally {
            setLoading(false)
        }
    }, [toast, mesRefStr])

    useEffect(() => { loadItems() }, [loadItems])

    const handleCreate = async () => {
        if (!newNome.trim()) return
        try {
            await ShoppingService.create({ nome: newNome.trim(), mes_ref: mesRefStr })
            toast({ title: 'Sucesso', description: 'Item adicionado!' })
            setNewNome('')
            loadItems()
        } catch {
            toast({ title: 'Erro', description: 'Falha ao adicionar item.', variant: 'destructive' })
        }
    }

    const handleToggle = async (item: ShoppingItem) => {
        try {
            await ShoppingService.update(item.id, { marcado: !item.marcado })
            loadItems()
        } catch {
            toast({ title: 'Erro', description: 'Falha ao atualizar item.', variant: 'destructive' })
        }
    }

    const handleUpdateNome = async (id: number) => {
        if (!editNome.trim()) return
        try {
            await ShoppingService.update(id, { nome: editNome.trim() })
            toast({ title: 'Sucesso', description: 'Item atualizado!' })
            setEditingItem(null)
            loadItems()
        } catch {
            toast({ title: 'Erro', description: 'Falha ao atualizar item.', variant: 'destructive' })
        }
    }

    const handleDelete = async (id: number) => {
        if (!confirm('Excluir este item?')) return
        try {
            await ShoppingService.delete(id)
            toast({ title: 'Sucesso', description: 'Item excluído!' })
            loadItems()
        } catch {
            toast({ title: 'Erro', description: 'Falha ao excluir item.', variant: 'destructive' })
        }
    }

    const pendentes = items.filter(i => !i.marcado)
    const concluidos = items.filter(i => i.marcado)
    const pendentesFiltrados = pendentes.filter(i =>
        i.nome.toLowerCase().includes(searchPendentes.toLowerCase())
    )
    const concluidosFiltrados = concluidos.filter(i =>
        i.nome.toLowerCase().includes(searchConcluidas.toLowerCase())
    )

    return (
        <div className="space-y-6">
            {/* Add Item Form */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                        Novo Item
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-4">
                        <div className="flex-1 space-y-2">
                            <Label>Nome do Item</Label>
                            <Input
                                placeholder="Ex: Arroz, Feijão..."
                                value={newNome}
                                onChange={e => setNewNome(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                            />
                        </div>
                        <Button onClick={handleCreate} disabled={!newNome.trim()}>
                            <PlusCircle className="h-4 w-4 mr-2" />Adicionar
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Pendentes */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5 text-primary" />
                        Pendentes ({pendentes.length})
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Buscar item pendente..."
                            value={searchPendentes}
                            onChange={e => setSearchPendentes(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2].map(i => (
                                <div key={i} className="animate-pulse h-12 rounded-lg bg-muted" />
                            ))}
                        </div>
                    ) : pendentesFiltrados.length === 0 ? (
                        <p className="text-muted-foreground text-center py-4 text-sm">
                            {searchPendentes ? 'Nenhum item encontrado.' : 'Nenhum item pendente.'}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {pendentesFiltrados.map(item => (
                                <div key={item.id} className="border rounded-lg p-3 flex items-center justify-between">
                                    {editingItem?.id === item.id ? (
                                        <div className="flex items-end gap-2 w-full">
                                            <div className="flex-1 space-y-1">
                                                <Label className="text-xs">Nome</Label>
                                                <Input value={editNome} onChange={e => setEditNome(e.target.value)} />
                                            </div>
                                            <Button size="sm" onClick={() => handleUpdateNome(item.id)} disabled={!editNome.trim()}>
                                                <Save className="h-3.5 w-3.5 mr-1" />Salvar
                                            </Button>
                                            <Button size="sm" variant="outline" onClick={() => setEditingItem(null)}>Cancelar</Button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="checkbox"
                                                    checked={item.marcado}
                                                    onChange={() => handleToggle(item)}
                                                    className="h-4 w-4 rounded border-gray-300"
                                                />
                                                <span className="font-medium">{item.nome}</span>
                                            </div>
                                            <div className="flex gap-1">
                                                <Button variant="ghost" size="sm" onClick={() => { setEditingItem(item); setEditNome(item.nome) }}>
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                                </Button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Concluídos */}
            {concluidos.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <CheckCircle2 className="h-5 w-5 text-green-500" />
                            Concluídos ({concluidos.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Buscar item concluído..."
                                value={searchConcluidas}
                                onChange={e => setSearchConcluidas(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                        <div className="space-y-2">
                            {concluidosFiltrados.length === 0 ? (
                                <p className="text-muted-foreground text-center py-4 text-sm">Nenhum item encontrado.</p>
                            ) : (
                                concluidosFiltrados.map(item => (
                                    <div key={item.id} className="border border-green-200 rounded-lg p-3 bg-green-50/30 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={item.marcado}
                                                onChange={() => handleToggle(item)}
                                                className="h-4 w-4 rounded border-gray-300"
                                            />
                                            <div>
                                                <span className="font-medium text-green-700 line-through">{item.nome}</span>
                                                {item.data_conclusao && (
                                                    <p className="text-xs text-muted-foreground">
                                                        Concluído em {new Date(item.data_conclusao + 'T12:00:00').toLocaleDateString('pt-BR')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <Button variant="ghost" size="sm" onClick={() => handleDelete(item.id)}>
                                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                        </Button>
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
