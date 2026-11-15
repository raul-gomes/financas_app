import { useState, useEffect, ReactNode } from 'react';
import { SettingsService, Profile } from '@/services/settingsService';
import { useSession } from '@/contexts/AuthContext';
import { RoleContext } from '@/contexts/RoleContext';

export function RoleProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  // Id of the user whose profile has already been resolved (success or failure).
  // `loading` is derived from it so there is no render where a user id is known
  // but its role is not yet loading (that gap redirected admins on page reload).
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null);
  const { user, loading: authLoading } = useSession();
  const userId = user?.id ?? null;

  useEffect(() => {
    let active = true;

    if (!userId) {
      setIsAdmin(false);
      setResolvedUserId(null);
      return () => {
        active = false;
      };
    }

    SettingsService.getProfile()
      .then((profile: Profile) => {
        if (active) setIsAdmin(profile.role === 'admin');
      })
      .catch((error: unknown) => {
        console.error('Failed to load profile role; treating user as non-admin:', error);
        if (active) setIsAdmin(false);
      })
      .finally(() => {
        if (active) setResolvedUserId(userId);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const roleLoading = userId !== null && resolvedUserId !== userId;
  const loading = authLoading || roleLoading;

  return (
    <RoleContext.Provider value={{ isAdmin, loading }}>
      {children}
    </RoleContext.Provider>
  );
}
