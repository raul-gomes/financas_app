import { createContext, useContext, useState, ReactNode } from 'react';

interface SidebarContextType {
  open: boolean;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

const SidebarContext = createContext<SidebarContextType>({
  open: false,
  toggle: () => {},
  setOpen: () => {},
});

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((prev) => !prev);

  return (
    <SidebarContext.Provider value={{ open, toggle, setOpen }}>
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
