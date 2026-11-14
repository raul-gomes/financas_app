import { useQuery } from '@tanstack/react-query';
import { SettingsService } from '@/services/settingsService';
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
