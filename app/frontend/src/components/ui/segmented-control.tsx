import * as React from "react"
import { cn } from "@/lib/utils"

export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
  /** Text color of the option when selected (token class, e.g. "text-success"). */
  selectedClassName?: string
}

interface SegmentedControlProps<T extends string> {
  options: readonly SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  "aria-label": string
  /** `compact` keeps the small desktop look (`px-3 py-1 text-xs`); `md` is the regular one. */
  size?: "md" | "compact"
  /** Options share the full width (use on mobile forms and headers). */
  fill?: boolean
  className?: string
}

/**
 * Segmented selector (radiogroup) such as PF/PJ or Entrada/Saída. Options are at
 * least 44px tall below `md` so they are comfortable touch targets; desktop keeps
 * the compact look. Arrow keys move the selection (roving tabindex).
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  size = "md",
  fill = false,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])

  const move = (from: number, step: number) => {
    const next = (from + step + options.length) % options.length
    onChange(options[next].value)
    refs.current[next]?.focus()
  }

  const onKeyDown = (event: React.KeyboardEvent, index: number) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      move(index, 1)
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      move(index, -1)
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn("flex items-center rounded-lg bg-muted p-1", className)}
    >
      {options.map((option, index) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            ref={(node) => {
              refs.current[index] = node
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            onKeyDown={(event) => onKeyDown(event, index)}
            className={cn(
              "inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-[44px]",
              size === "compact" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm",
              fill && "flex-1",
              selected
                ? cn("bg-card shadow-sm", option.selectedClassName ?? "text-foreground")
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
