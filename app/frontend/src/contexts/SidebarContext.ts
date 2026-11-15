import { createContext, useContext } from 'react';

/** State of the Metas/Compras side panel of the financial page. */
export interface SidebarContextType {
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

export const SidebarContext = createContext<SidebarContextType | null>(null);

/** Open state of the side panel (`SidebarProvider` holds it). */
export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error('useSidebar must be used within a SidebarProvider');
  return ctx;
}
