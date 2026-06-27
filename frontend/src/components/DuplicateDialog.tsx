import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Trash2, Edit3, ChevronLeft, ChevronRight } from 'lucide-react'
import type { DuplicateInfo, Transaction } from '@/types/financial'

export type DialogAction = 'keep' | 'replace' | 'edit'

interface ConflictItem {
  index: number
  existing: DuplicateInfo
  newData: {
    descricao: string
    valor: number
    data_transacao: string
  }
}

interface DuplicateDialogProps {
  open: boolean
  conflicts: ConflictItem[]
  /** Single mode: called when user picks an action */
  onResolve: (action: DialogAction, index: number) => void
  /** Bulk mode: called with action for all remaining */
  onResolveAll?: (action: DialogAction) => void
  /** Called when confirming close — i.e. user resolved the last conflict */
  onDone?: () => void
  /** Called when dismissing the dialog (outside click / Escape) */
  onClose: () => void
}

export function DuplicateDialog({
  open,
  conflicts,
  onResolve,
  onResolveAll,
  onDone,
  onClose,
}: DuplicateDialogProps) {
  const [currentIdx, setCurrentIdx] = useState(0)
  const isBulk = conflicts.length > 1
  // Safe index: keep currentIdx in bounds when conflicts array shrinks
  // (parent may remove resolved conflicts asynchronously)
  const safeIdx = conflicts.length === 0 ? -1 : Math.min(currentIdx, conflicts.length - 1)
  const current = conflicts[safeIdx]
  const total = conflicts.length

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  const handleAction = (action: DialogAction) => {
    if (!current) return
    onResolve(action, current.index)
    if (currentIdx < total - 1) {
      setCurrentIdx(i => i + 1)
    } else {
      onDone?.()
      onClose()
    }
  }

  const handleResolveAll = (action: DialogAction) => {
    onResolveAll?.(action)
    onDone?.()
    onClose()
  }

  if (!current) return null

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <DialogTitle>Duplicata Encontrada</DialogTitle>
          </div>
          <DialogDescription>
            Já existe uma transação com a mesma data e valor.
          </DialogDescription>
        </DialogHeader>

        {isBulk && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <Button variant="ghost" size="sm" disabled={currentIdx === 0} onClick={() => setCurrentIdx(i => i - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>{currentIdx + 1} de {total}</span>
            <Button variant="ghost" size="sm" disabled={currentIdx >= total - 1} onClick={() => setCurrentIdx(i => i + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        <div className="space-y-4">
          {/* Existing */}
          <div className="rounded-lg border border-border p-3">
            <p className="text-xs font-medium text-muted-foreground mb-2">Transação existente:</p>
            <p className="font-medium">{current.existing.descricao}</p>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(current.existing.valor)} — {new Date(current.existing.data_transacao).toLocaleDateString('pt-BR')}
            </p>
            {current.existing.categoria_nome && (
              <p className="text-xs text-muted-foreground mt-1">
                {current.existing.categoria_nome}{current.existing.subcategoria_nome ? ` / ${current.existing.subcategoria_nome}` : ''}
              </p>
            )}
          </div>

          {/* Nova */}
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-medium text-primary mb-2">Nova transação:</p>
            <p className="font-medium">{current.newData.descricao}</p>
            <p className="text-sm text-muted-foreground">
              {formatCurrency(current.newData.valor)} — {new Date(current.newData.data_transacao + 'T12:00:00').toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1" onClick={() => handleAction('keep')}>
              Manter
            </Button>
            <Button variant="destructive" className="flex-1" onClick={() => handleAction('replace')}>
              <Trash2 className="h-4 w-4 mr-2" /> Excluir
            </Button>
            <Button variant="default" className="flex-1" onClick={() => handleAction('edit')}>
              <Edit3 className="h-4 w-4 mr-2" /> Editar
            </Button>
          </div>
          {isBulk && onResolveAll && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="flex-1 text-xs" onClick={() => handleResolveAll('keep')}>
                Manter todos
              </Button>
              <Button variant="ghost" size="sm" className="flex-1 text-xs text-destructive" onClick={() => handleResolveAll('replace')}>
                Excluir todos
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
