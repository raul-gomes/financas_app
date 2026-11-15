import { useEffect, useMemo, useState } from 'react';
import { useBanks } from '@/hooks/queries/useSettingsQueries';
import { useTransactionsInfinite } from '@/hooks/queries/useTransactionQueries';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useToast } from '@/hooks/use-toast';
import type { DateRangeInput } from '@/lib/queryKeys';

/** Wait after the last keystroke before searching on the server. */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Data side of the transactions list (shared by the desktop and mobile views): the
 * server-paged list for the period + PF/PJ scope, the debounced text search and the
 * bank names. Banks are cached and shared with the Settings screen.
 */
export function useTransactionList(dateRange: DateRangeInput, entityType: string) {
  const [searchQuery, setSearchQuery] = useState('');
  const { toast } = useToast();

  const { data: banks = [], isError: isBanksError, error: banksError } = useBanks();
  useEffect(() => {
    if (!isBanksError) return;
    console.error('Error loading banks:', banksError);
    toast({ title: 'Erro', description: 'Falha ao carregar os bancos.', variant: 'destructive' });
  }, [isBanksError, banksError, toast]);

  const debouncedSearch = useDebouncedValue(searchQuery.trim(), SEARCH_DEBOUNCE_MS);
  const query = useTransactionsInfinite({ dateRange, entityType, search: debouncedSearch });

  const transactions = useMemo(() => query.data?.pages.flatMap((page) => page.items) ?? [], [query.data]);
  const total = query.data?.pages[0]?.total ?? 0;

  const getBankName = (bankCode: string | null | undefined): string | null => {
    if (!bankCode) return null;
    return banks.find((b) => b.bank_code === bankCode)?.bank_name || null;
  };

  return {
    searchQuery,
    setSearchQuery,
    transactions,
    total,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
    getBankName,
  };
}
