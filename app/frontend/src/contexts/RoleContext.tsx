import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { SettingsService, Profile } from '@/services/settingsService';

interface RoleContextType {
  isAdmin: boolean;
  loading: boolean;
}

const RoleContext = createContext<RoleContextType | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    SettingsService.getProfile()
      .then((profile: Profile) => {
        if (active) setIsAdmin(profile.role === 'admin');
      })
      .catch(() => {
        if (active) setIsAdmin(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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
