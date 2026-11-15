import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { SettingsService, type BankCreate, type UserBank } from '@/services/settingsService';
import { queryKeys } from '@/lib/queryKeys';

/** Profile of the authenticated user. */
export function useProfile() {
  return useQuery({
    queryKey: queryKeys.settings.profile(),
    queryFn: () => SettingsService.getProfile(),
  });
}

/** Banks registered by the user (shared by Settings and the transactions list). */
export function useBanks() {
  return useQuery({
    queryKey: queryKeys.settings.banks(),
    queryFn: () => SettingsService.listBanks(),
  });
}

/**
 * Registers a bank. The new bank is put in the cached list at once (selects can show it
 * right away) and the list is then refreshed from the server.
 */
export function useAddBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: BankCreate) => SettingsService.addBank(payload),
    onSuccess: (created) => {
      queryClient.setQueryData<UserBank[]>(queryKeys.settings.banks(), (prev) => [...(prev ?? []), created]);
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.all });
    },
  });
}
