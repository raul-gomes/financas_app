import * as React from "react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { BANK_COLORS, bankInitials, bankLogoUrl } from "@/lib/bankLogo"

/** Fallback padrão com iniciais coloridas (usado por Settings e pelo modal de transação). */
export function BankLogoFallback({
  name,
  index = 0,
  size = "sm",
  className,
}: {
  name: string
  index?: number
  size?: "xs" | "sm" | "md" | "lg"
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded font-bold leading-none text-primary-foreground",
        sizeClasses[size],
        BANK_COLORS[index % BANK_COLORS.length],
        className,
      )}
    >
      {bankInitials(name)}
    </span>
  )
}

interface BankLogoProps {
  /** Código FEBRABAN do banco. Se ausente, exibe o fallback. */
  code?: string | null
  size?: "xs" | "sm" | "md" | "lg"
  /** Classes extras aplicadas ao <img> e ao fallback padrão. */
  className?: string
  alt?: string
  /** Conteúdo custom exibido sem código ou em falha de carregamento. Padrão: badge com o código. */
  fallback?: React.ReactNode
}

const sizeClasses: Record<NonNullable<BankLogoProps["size"]>, string> = {
  xs: "w-4 h-4 text-[6px]",
  sm: "w-5 h-5 text-[8px]",
  md: "w-6 h-6 text-[10px]",
  lg: "w-10 h-10 text-sm",
}

/**
 * Logo de banco com fallback automático em caso de falha de carregamento.
 * Substitui os blocos duplicados `img + logoErrors` espalhados pelo app.
 */
export function BankLogo({ code, size = "sm", className, alt, fallback }: BankLogoProps) {
  const [failed, setFailed] = useState(false)

  if (!code || failed) {
    if (fallback) return <>{fallback}</>
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded bg-primary/10 font-bold leading-none text-primary",
          sizeClasses[size],
          className,
        )}
      >
        {code ?? "?"}
      </span>
    )
  }

  return (
    <img
      src={bankLogoUrl(code)}
      alt={alt ?? ""}
      loading="lazy"
      className={cn("shrink-0 rounded object-contain bg-card", sizeClasses[size], className)}
      onError={() => setFailed(true)}
    />
  )
}
