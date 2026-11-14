import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

/** Shows a destructive pt-BR toast once each time a query switches to the error state. */
export function useErrorToast(isError: boolean, message: string): void {
  const { toast } = useToast();

  useEffect(() => {
    if (isError) toast({ title: 'Erro', description: message, variant: 'destructive' });
    // toast is a stable global dispatcher; only a new error should notify
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isError, message]);
}
