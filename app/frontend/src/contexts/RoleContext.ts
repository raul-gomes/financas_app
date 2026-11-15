import { createContext, useContext } from 'react';

/** What `useRole` returns: whether the user is an admin and whether that is still being resolved. */
export interface RoleContextType {
  isAdmin: boolean;
  loading: boolean;
}

export const RoleContext = createContext<RoleContextType | null>(null);

/** Role of the current user (`RoleProvider` resolves it from the profile). */
export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error('useRole must be used within a RoleProvider');
  return ctx;
}
