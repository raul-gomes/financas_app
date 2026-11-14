/** Minimal shape of the `toast` function of `useToast` that this helper needs. */
type ToastFn = (options: { title: string; description: string; variant: 'destructive' }) => unknown;

/**
 * Handles a failed background load (categories, banks...) explicitly: logs the error and
 * warns the user with a pt-BR toast, instead of swallowing it in an empty `catch`.
 * `what` completes the sentence, e.g. "as categorias" -> "Falha ao carregar as categorias.".
 */
export function reportLoadError(toast: ToastFn, what: string, error: unknown): void {
  console.error(`Falha ao carregar ${what}:`, error);
  toast({ title: 'Erro', description: `Falha ao carregar ${what}.`, variant: 'destructive' });
}
