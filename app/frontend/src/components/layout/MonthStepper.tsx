import { ChevronLeft, ChevronRight } from 'lucide-react';

/** A calendar month; `month` is 1-12. */
export interface YearMonth {
  year: number;
  month: number;
}

/** Short pt-BR month names ("nov 2026" in the stepper). */
const SHORT_MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'] as const;

/** Months in a year, used to roll the year over. */
const MONTHS_PER_YEAR = 12;

/** The month `delta` months after (or before, if negative) `from`. */
export function addMonths(from: YearMonth, delta: number): YearMonth {
  const index = from.year * MONTHS_PER_YEAR + (from.month - 1) + delta;
  return { year: Math.floor(index / MONTHS_PER_YEAR), month: (index % MONTHS_PER_YEAR) + 1 };
}

interface MonthStepperProps extends YearMonth {
  onChange: (next: YearMonth) => void;
}

/**
 * Compact month selector ("‹ nov 2026 ›") for the mobile top bar slot. Arrow
 * buttons are 44px touch targets.
 */
export function MonthStepper({ year, month, onChange }: MonthStepperProps) {
  const step = (delta: number) => onChange(addMonths({ year, month }, delta));
  return (
    <div className="flex items-center rounded-full bg-muted px-0.5">
      <button
        type="button"
        aria-label="Mês anterior"
        onClick={() => step(-1)}
        className="grid h-11 w-11 place-items-center rounded-full text-foreground"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <span className="min-w-[4.5rem] text-center text-sm font-semibold text-foreground">
        {SHORT_MONTHS[month - 1]} {year}
      </span>
      <button
        type="button"
        aria-label="Próximo mês"
        onClick={() => step(1)}
        className="grid h-11 w-11 place-items-center rounded-full text-foreground"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
