import * as React from "react"
import { useState } from "react"
import { cn } from "@/lib/utils"

export const BANK_LOGO_CDN =
  "https://cdn.jsdelivr.net/gh/wesguirra/brazil-bank-data@main/bank-logos/256/png"

/** URL do logo a partir do código FEBRABAN (ex.: '260' → .../260.png). */
export const bankLogoUrl = (code: string) => `${BANK_LOGO_CDN}/${code.padStart(3, "0")}.png`

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
