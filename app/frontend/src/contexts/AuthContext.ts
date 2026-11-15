import { createContext, useContext } from 'react';
import type { Session } from '@supabase/supabase-js';

/** What `useSession` returns: the Supabase session, its user and whether it is still loading. */
export interface AuthContextType {
  session: Session | null;
  user: Session['user'] | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
});

/** The current Supabase session (`AuthProvider` keeps it up to date). */
export function useSession() {
  return useContext(AuthContext);
}
