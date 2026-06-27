import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Pencil, PlusCircle, RefreshCw, ToggleLeft, ToggleRight, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ContaRecorrenteService } from '@/services/contaRecorrenteService'
import { ContaRecorrente, ContaRecorrenteCreate, ContaRecorrenteUpdate } from '@/types/conta_recorrente'
import { ContaForm } from './ContaForm'

const BANK_LOGO_CDN = 'https://cdn.jsdelivr.net/gh/ranulagu/bank-logos@main/bank-logos/256/png'

// ===== Recorrentes Tab =====
export const RecorrentesTab = () => {
    const [contas, setContas] = useState<ContaRecorrente[]>([])
    const [formMode, setFormMode] = useState<{ type: 'create' } | { type: 'edit', conta: ContaRecorrente } | null>(null)
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
            setFormMode(null)
            loadContas()
        } catch {
            toast({ title: 'Erro', description: 'Falha ao criar.', variant: 'destructive' })
        }
    }

    const handleUpdate = async (id: number, payload: ContaRecorrenteUpdate) => {
        try {
            await ContaRecorrenteService.update(id, payload)
            toast({ title: 'Sucesso', description: 'Conta recorrente atualizada!' })
            setFormMode(null)
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
                <Button onClick={() => setFormMode({ type: 'create' })} className="bg-gradient-primary">
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
                                <th className="text-left px-4 py-3 text-sm font-medium text-muted-foreground">Banco</th>
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
                                        {conta.bank_code ? (
                                            <div className="flex items-center gap-1.5">
                                                <img
                                                    src={`${BANK_LOGO_CDN}/${conta.bank_code.padStart(3, '0')}.png`}
                                                    alt=""
                                                    className="w-4 h-4 rounded object-contain bg-card"
                                                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                                                />
                                                <span>{conta.bank_code}</span>
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground/50">—</span>
                                        )}
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
                                            <Button variant="ghost" size="sm" onClick={() => setFormMode({ type: 'edit', conta })}>
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

            {formMode && (
                <ContaForm
                    key={formMode.type === 'edit' ? formMode.conta.id : 'create'}
                    conta={formMode.type === 'edit' ? formMode.conta : null}
                    onClose={() => setFormMode(null)}
                    onSubmit={(payload) => formMode.type === 'edit'
                        ? handleUpdate(formMode.conta.id, payload)
                        : handleCreate(payload as ContaRecorrenteCreate)}
                />
            )}
        </div>
    )
}
