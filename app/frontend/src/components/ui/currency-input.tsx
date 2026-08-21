import * as React from "react"
import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> {
  /** Valor canônico com ponto decimal (ex.: "1234.56"); "" = vazio. */
  value: string
  /** Emite o valor canônico normalizado a cada edição válida e no blur. */
  onChange: (value: string) => void
}

const formatDisplay = (canonical: string): string => {
  if (!canonical) return ""
  const num = Number(canonical)
  if (Number.isNaN(num)) return canonical
  return num.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Converte o rascunho digitado (aceita "1234,56", "1.234,56", "1234.56") para canônico. */
const parseDraft = (raw: string): string => {
  const cleaned = raw.replace(/[^\d.,]/g, "")
  if (!cleaned) return ""
  const lastComma = cleaned.lastIndexOf(",")
  const lastDot = cleaned.lastIndexOf(".")
  const decSepIdx = Math.max(lastComma, lastDot)
  let normalized: string
  if (decSepIdx === -1) {
    normalized = cleaned.replace(/[.,]/g, "")
  } else {
    const intPart = cleaned.slice(0, decSepIdx).replace(/[.,]/g, "")
    const decPart = cleaned.slice(decSepIdx + 1).replace(/[.,]/g, "")
    normalized = `${intPart || "0"}.${decPart}`
  }
  const num = Number(normalized)
  return Number.isNaN(num) ? "" : normalized
}

/**
 * Input de moeda com prefixo R$ e máscara pt-BR.
 *
 * - Exibição (desfocado): `1.234,50`
 * - Digitação: aceita dígitos, `,` e `.` (bloqueia o resto)
 * - Contrato com formulários: `value`/`onChange` sempre em string canônica
 *   com ponto decimal ("1234.56"), compatível com `parseFloat` existente.
 */
export function CurrencyInput({ value, onChange, className, ...props }: CurrencyInputProps) {
  const [focused, setFocused] = useState(false)
  const [draft, setDraft] = useState(value)

  useEffect(() => {
    if (!focused) setDraft(value)
  }, [value, focused])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const parsed = parseDraft(e.target.value)
    setDraft(parsed)
    onChange(parsed)
  }

  return (
    <div className="relative">
      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sm text-muted-foreground">
        R$
      </span>
      <input
        {...props}
        type="text"
        inputMode="decimal"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-base ring-offset-background",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        value={focused ? draft : formatDisplay(value)}
        onChange={handleChange}
        onFocus={(e) => {
          setFocused(true)
          setDraft(parseDraft(value))
          props.onFocus?.(e)
        }}
        onBlur={(e) => {
          setFocused(false)
          onChange(draft)
          props.onBlur?.(e)
        }}
      />
    </div>
  )
}
