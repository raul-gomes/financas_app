import { useEffect, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { PlusCircle, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ContaRecorrenteService } from '@/services/recurringAccountService'
import { ContaRecorrente, ContaRecorrenteCreate, ContaRecorrenteUpdate } from '@/types/recurringAccount'
import { ContaForm } from './ContaForm'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { EmptyState } from '@/components/ui/empty-state'
import { RecurringBillsTable } from '@/components/recorrentes/RecurringBillsTable'

interface RecorrentesTabProps {
    entityTypeFilter?: 'pf' | 'pj' | 'all'
}

// ===== Recorrentes Tab =====
export const RecorrentesTab = ({ entityTypeFilter = 'all' }: RecorrentesTabProps) => {
    const [contas, setContas] = useState<ContaRecorrente[]>([])
    const [formMode, setFormMode] = useState<{ type: 'create' } | { type: 'edit', conta: ContaRecorrente } | null>(null)
    const [renewingId, setRenewingId] = useState<number | null>(null)
    const [pendingToggle, setPendingToggle] = useState<ContaRecorrente | null>(null)
    const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null)
    const { toast } = useToast()

    const loadContas = useCallback(async () => {
        try {
            const entityTypeParam = entityTypeFilter === 'all' ? undefined : (entityTypeFilter === 'pf' ? 'individual' : 'business')
            setContas(await ContaRecorrenteService.getAll(entityTypeParam))
        } catch {
            toast({ title: 'Erro', description: 'Falha ao carregar contas recorrentes.', variant: 'destructive' })
        }
    }, [toast, entityTypeFilter])

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

    const doToggleActive = async (conta: ContaRecorrente) => {
        try {
            await ContaRecorrenteService.update(conta.id, { active: !conta.active })
            toast({
                title: 'Sucesso',
                description: conta.active
                    ? `Conta desativada. ${conta.remaining_installments} parcelas futuras canceladas.`
                    : 'Conta ativada.',
            })
            loadContas()
        } catch {
            toast({ title: 'Erro', description: 'Falha ao alterar status.', variant: 'destructive' })
        }
    }

    const handleToggleActive = (conta: ContaRecorrente) => setPendingToggle(conta)

    const doDelete = async (id: number) => {
        try { await ContaRecorrenteService.delete(id); toast({ title: 'Sucesso', description: 'Conta excluida!' }); loadContas() } catch {
            toast({ title: 'Erro', description: 'Falha ao excluir.', variant: 'destructive' })
        }
    }

    const handleDelete = (id: number) => setPendingDeleteId(id)

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
                <div className="bg-card rounded-lg border border-border">
                    <EmptyState
                        icon={RefreshCw}
                        title="Nenhuma conta recorrente cadastrada."
                        description="Clique no botão acima para adicionar."
                    />
                </div>
            ) : (
                <div className="bg-card rounded-lg border border-border overflow-hidden">
                    <RecurringBillsTable
                        contas={contas}
                        showBank
                        onToggleActive={handleToggleActive}
                        onEdit={(conta) => setFormMode({ type: 'edit', conta })}
                        onDelete={handleDelete}
                        onRenew={handleRenew}
                        renewingId={renewingId}
                    />
                </div>
            )}

            {formMode && (
                <ContaForm
                    key={formMode.type === 'edit' ? formMode.conta.id : 'create'}
                    conta={formMode.type === 'edit' ? formMode.conta : null}
                    defaultEntityType={entityTypeFilter === 'pj' ? 'business' : 'individual'}
                    onClose={() => setFormMode(null)}
                    onSubmit={(payload) => formMode.type === 'edit'
                        ? handleUpdate(formMode.conta.id, payload)
                        : handleCreate(payload as ContaRecorrenteCreate)}
                />
            )}

            <ConfirmDialog
                open={pendingToggle !== null}
                onOpenChange={(open) => { if (!open) setPendingToggle(null) }}
                title={pendingToggle?.active ? 'Desativar conta recorrente?' : 'Ativar conta recorrente?'}
                description={
                    pendingToggle?.active
                        ? `Isso cancelará as ${pendingToggle.remaining_installments} parcelas futuras.`
                        : undefined
                }
                confirmLabel={pendingToggle?.active ? 'Desativar' : 'Ativar'}
                destructive={!!pendingToggle?.active}
                onConfirm={() => { if (pendingToggle) void doToggleActive(pendingToggle) }}
            />

            <ConfirmDialog
                open={pendingDeleteId !== null}
                onOpenChange={(open) => { if (!open) setPendingDeleteId(null) }}
                title="Excluir esta conta recorrente?"
                description="Esta ação não pode ser desfeita."
                destructive
                confirmLabel="Excluir"
                onConfirm={() => { if (pendingDeleteId !== null) void doDelete(pendingDeleteId) }}
            />
        </div>
    )
}
