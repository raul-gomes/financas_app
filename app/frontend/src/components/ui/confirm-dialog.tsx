import * as React from "react"
import { ResponsiveModal } from "@/components/ui/responsive-modal"
import { Button } from "@/components/ui/button"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Use true para ações destrutivas (excluir etc.). */
  destructive?: boolean
  onConfirm: () => void
}

/**
 * Confirmação padronizada do projeto (substitui window.confirm nativo).
 *
 * ```tsx
 * <ConfirmDialog
 *   open={!!alvo}
 *   onOpenChange={(o) => !o && setAlvo(null)}
 *   title="Excluir conta recorrente?"
 *   description="Esta ação não pode ser desfeita."
 *   destructive
 *   confirmLabel="Excluir"
 *   onConfirm={() => handleDelete(alvo.id)}
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      size="sm"
      footer={
        <>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
    </ResponsiveModal>
  )
}
