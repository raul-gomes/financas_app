import type { Transaction } from '@/types/financial';

/** Text and avatar color tokens per transaction type (income, expense, investment). */
export const TYPE_TONE: Record<Transaction['type'], { text: string; avatar: string }> = {
  income: { text: 'text-success', avatar: 'bg-success/10 text-success' },
  expense: { text: 'text-destructive', avatar: 'bg-destructive/10 text-destructive' },
  investment: { text: 'text-warning', avatar: 'bg-warning/10 text-warning' },
};
