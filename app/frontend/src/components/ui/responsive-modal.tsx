import * as React from "react"
import { cn } from "@/lib/utils"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

type ResponsiveModalSize = "sm" | "md" | "lg" | "xl"

const sizeClasses: Record<ResponsiveModalSize, string> = {
  sm: "md:max-w-lg",
  md: "md:max-w-xl",
  lg: "md:max-w-3xl",
  xl: "md:max-w-7xl",
}

interface ResponsiveModalProps {
  /** Omita para modo não controlado (usado com DialogTrigger). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Omita para modais com header totalmente customizado. */
  title?: React.ReactNode
  description?: React.ReactNode
  /**
   * Conteúdo rolável do modal (formulários, listas etc.).
   * É a única região que rola — header e footer permanecem fixos.
   */
  children: React.ReactNode
  /**
   * Ações fixas no rodapé. Em formulários, use `type="submit"` com o
   * atributo `form="<id>"` apontando para o `<form id="...">` no body.
   */
  footer?: React.ReactNode
  /** Largura máxima progressiva: sm (celular grande) → xl (telas amplas). */
  size?: ResponsiveModalSize
  className?: string
  bodyClassName?: string
}

/**
 * Modal responsivo mobile-first.
 *
 * - Celular (abaixo de `md`): folha ancorada embaixo (bottom sheet), largura
 *   total, cantos superiores arredondados e até `92dvh` de altura (respeita a
 *   barra de endereço dos navegadores móveis); campos em coluna única.
 * - Desktop (`md:`): caixa centralizada com largura máxima por `size`; combine
 *   com grids `sm:grid-cols-2` no corpo para reduzir a altura e evitar scroll.
 *
 * Estrutura em 3 camadas: header fixo → corpo com scroll contido → footer fixo.
 * O scroll nunca acontece no box inteiro.
 */
export function ResponsiveModal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
  bodyClassName,
}: ResponsiveModalProps) {
  return (
    <Dialog
      {...(open !== undefined ? { open, onOpenChange } : {})}
    >
      <DialogContent
        className={cn(
          "flex flex-col gap-0 p-0 overflow-hidden max-h-[92dvh] max-w-full",
          // Mobile: bottom sheet sliding up from the bottom edge.
          "max-md:inset-x-0 max-md:bottom-0 max-md:top-auto max-md:w-full max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-b-none max-md:rounded-t-[22px] max-md:sm:rounded-b-none max-md:sm:rounded-t-[22px]",
          "max-md:data-[state=open]:slide-in-from-bottom max-md:data-[state=closed]:slide-out-to-bottom",
          "max-md:data-[state=open]:slide-in-from-left-0 max-md:data-[state=closed]:slide-out-to-left-0",
          "max-md:data-[state=open]:zoom-in-100 max-md:data-[state=closed]:zoom-out-100",
          // Desktop: centered dialog.
          "md:left-[50%] md:top-[50%] md:w-[calc(100vw-1rem)] md:translate-x-[-50%] md:translate-y-[-50%] md:rounded-lg",
          sizeClasses[size],
          className
        )}
      >
        <div aria-hidden="true" className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-border md:hidden" />
        {title != null ? (
          <DialogHeader className="shrink-0 space-y-1 px-5 pt-5 pb-3 text-left sm:px-6 sm:pt-6">
            <DialogTitle>{title}</DialogTitle>
            {description ? <DialogDescription>{description}</DialogDescription> : null}
          </DialogHeader>
        ) : null}
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-5 pb-4 sm:px-6",
            bodyClassName
          )}
        >
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t bg-muted/30 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
            <DialogFooter className="gap-2 sm:gap-0">{footer}</DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
