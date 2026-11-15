/** The fields of the Pluggy sync result that the summary reads. */
export interface SyncSummaryInput {
  message: string;
  /** Rows of the bank that were already in the app (includes the linked ones). */
  skipped: number;
  /** Existing entries that were adopted (linked to the bank's id) instead of imported again. */
  linked: number;
}

/**
 * Sentence shown after a Pluggy sync: the server message plus how many transactions were
 * already in the app and how many existing entries were linked to the bank.
 */
export function formatSyncSummary({ message, skipped, linked }: SyncSummaryInput): string {
  if (skipped <= 0) return message;
  const existing = skipped === 1 ? '1 já estava no app' : `${skipped} já estavam no app`;
  const adopted =
    linked > 0
      ? ` (${linked === 1 ? '1 vinculada a lançamento existente' : `${linked} vinculadas a lançamentos existentes`})`
      : '';
  return `${message} ${existing}${adopted}.`;
}
