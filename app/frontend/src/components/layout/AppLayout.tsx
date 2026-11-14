// src/components/layout/AppLayout.tsx
import { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { DollarSign, BarChart3, TrendingUp, SlidersHorizontal, Settings, RefreshCw, Landmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/brand/Logo';
import { SidebarProvider } from '@/contexts/SidebarContext';
import { useRole } from '@/contexts/RoleContext';
import { AddTransactionDialog } from '@/components/dialogs/AddTransactionDialog';
import { LogoutButton } from './LogoutButton';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { MobileTabBar } from './MobileTabBar';
import { MobileTopBar, MobileTopBarSlotContext } from './MobileTopBar';
import { MORE_ROUTE, getRouteTitle } from './navigation';

function LayoutContent() {
  const { isAdmin } = useRole();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const [monthSlot, setMonthSlot] = useState<HTMLElement | null>(null);
  // The dialog mounts on first use (no category/bank fetches until then) and stays mounted for its exit animation.
  const [addMounted, setAddMounted] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? 'bg-primary text-primary-foreground'
      : 'text-muted-foreground hover:bg-muted';

  const openAddTransaction = () => {
    setAddMounted(true);
    setAddOpen(true);
  };

  // The page stays mounted (month and filters are kept): every active query refetches through the cache.
  const handleTransactionAdded = () => {
    void queryClient.invalidateQueries();
  };

  return (
    <MobileTopBarSlotContext.Provider value={monthSlot}>
      <div className="min-h-screen bg-gradient-subtle">
        <MobileTopBar
          title={getRouteTitle(pathname)}
          slotRef={setMonthSlot}
          showBell={pathname !== MORE_ROUTE}
        />

        <header className="hidden border-b border-border bg-card shadow-elegant md:block">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-6">
            <NavLink to="/" aria-label="Placo, ir para o início" className="shrink-0">
              <Logo />
            </NavLink>
            <nav className="flex items-center gap-1 sm:gap-2">
              <NavLink to="/" className={linkClass}>
                <Button variant="ghost" size="sm" className="flex items-center gap-1">
                  <BarChart3 className="h-4 w-4" /><span className="hidden sm:inline">Visão Geral</span>
                </Button>
              </NavLink>
              <NavLink to="/financial" className={linkClass}>
                <Button variant="ghost" size="sm" className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" /><span className="hidden sm:inline">Financeiro</span>
                </Button>
              </NavLink>
              {isAdmin && (
                <NavLink to="/investments" className={linkClass}>
                  <Button variant="ghost" size="sm" className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" /><span className="hidden sm:inline">Investimentos</span>
                  </Button>
                </NavLink>
              )}
              <NavLink to="/limits" className={linkClass}>
                <Button variant="ghost" size="sm" className="flex items-center gap-1">
                  <SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">Limites</span>
                </Button>
              </NavLink>
              {isAdmin && (
                <>
                  {/* Admin pages: labels only from lg so seven items still fit at md */}
                  <NavLink to="/recorrentes" aria-label="Recorrentes" title="Recorrentes" className={linkClass}>
                    <Button variant="ghost" size="sm" className="flex items-center gap-1">
                      <RefreshCw className="h-4 w-4" /><span className="hidden lg:inline">Recorrentes</span>
                    </Button>
                  </NavLink>
                  <NavLink to="/extrato-bancario" aria-label="Extrato bancário" title="Extrato bancário" className={linkClass}>
                    <Button variant="ghost" size="sm" className="flex items-center gap-1">
                      <Landmark className="h-4 w-4" /><span className="hidden lg:inline">Extrato bancário</span>
                    </Button>
                  </NavLink>
                </>
              )}
              <NavLink to="/configuracoes" className={linkClass}>
                <Button variant="ghost" size="sm" className="flex items-center gap-1">
                  <Settings className="h-4 w-4" /><span className="hidden sm:inline">Configurações</span>
                </Button>
              </NavLink>
              <NotificationBell />
              <LogoutButton />
            </nav>
          </div>
        </header>

        {/* Bottom padding keeps content clear of the fixed tab bar (mobile only); relative z-0 makes main its own stacking context so 3D-transformed charts cannot paint over the bar. No page may be wider than the screen (a page that is would widen the layout viewport and push the fixed tab bar off-screen); wide content scrolls inside its own container. */}
        <main className="relative z-0 min-w-0 flex-1 pb-[calc(5.5rem+env(safe-area-inset-bottom))] transition-all duration-300 md:pb-0">
          <Outlet />
        </main>

        <MobileTabBar onAddTransaction={openAddTransaction} />
        {addMounted && (
          <AddTransactionDialog
            isOpen={addOpen}
            onClose={() => setAddOpen(false)}
            onAddTransaction={handleTransactionAdded}
          />
        )}
      </div>
    </MobileTopBarSlotContext.Provider>
  );
}

export function AppLayout() {
  return (
    <SidebarProvider>
      <LayoutContent />
    </SidebarProvider>
  );
}
