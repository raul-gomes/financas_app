import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SettingsService, Profile } from '@/services/settingsService';
import { useSession } from '@/contexts/AuthContext';

interface RoleContextType {
  isAdmin: boolean;
  loading: boolean;
}

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [roleLoading, setRoleLoading] = useState(true);
  const { user, loading: authLoading } = useSession();
  const userId = user?.id ?? null;

  useEffect(() => {
    let active = true;

    if (!userId) {
      setIsAdmin(false);
      setRoleLoading(false);
      return () => {
        active = false;
      };
    }

    setRoleLoading(true);
    SettingsService.getProfile()
      .then((profile: Profile) => {
        if (active) setIsAdmin(profile.role === 'admin');
      })
      .catch(() => {
        if (active) setIsAdmin(false);
      })
      .finally(() => {
        if (active) setRoleLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const loading = authLoading || roleLoading;

  return (
    <RoleContext.Provider value={{ isAdmin, loading }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within a RoleProvider');
  return ctx;
}