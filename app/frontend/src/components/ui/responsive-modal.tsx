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
  sm: "sm:max-w-md md:max-w-lg",
  md: "sm:max-w-lg md:max-w-xl",
  lg: "sm:max-w-2xl md:max-w-3xl",
  xl: "sm:max-w-5xl md:max-w-7xl",
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
 * - Celular (base): ocupa quase toda a largura/altura (`92dvh`, que respeita
 *   a barra de endereço dos navegadores móveis), campos em coluna única.
 * - Desktop (`sm:`/`md:`): largura máxima por `size`; combine com grids
 *   `sm:grid-cols-2` no corpo para reduzir a altura e evitar scroll.
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
          "flex flex-col left-[50%] top-[50%] translate-x-[-50%] translate-y-[-50%]",
          "w-[calc(100vw-1rem)] max-w-full gap-0 p-0 overflow-hidden rounded-lg",
          "max-h-[92dvh]",
          sizeClasses[size],
          className
        )}
      >
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
          <div className="shrink-0 border-t bg-muted/30 px-5 py-3 sm:px-6">
            <DialogFooter>{footer}</DialogFooter>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
