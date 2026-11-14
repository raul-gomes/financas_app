import type { LucideIcon } from 'lucide-react';
import { Home, Menu, Percent, Wallet } from 'lucide-react';

/** Route of the "Mais" (more) menu page on mobile. */
export const MORE_ROUTE = '/mais';

/** Routes reachable only through the "Mais" menu; the "Mais" tab stays active on them. */
export const MORE_GROUP_ROUTES: readonly string[] = [
  MORE_ROUTE,
  '/recorrentes',
  '/extrato-bancario',
  '/investments',
  '/configuracoes',
];

/** Top bar title per route on mobile; `null` means "show the logo". */
const ROUTE_TITLES: Record<string, string | null> = {
  '/': null,
  '/financial': 'Financeiro',
  '/limits': 'Limites',
  [MORE_ROUTE]: 'Mais',
  '/recorrentes': 'Contas recorrentes',
  '/extrato-bancario': 'Extrato bancário',
  '/investments': 'Investimentos',
  '/configuracoes': 'Configurações',
};

/**
 * Title for the mobile top bar. Returns `null` for the home route (the logo is
 * shown instead) and for unknown routes.
 */
export function getRouteTitle(pathname: string): string | null {
  return ROUTE_TITLES[pathname] ?? null;
}

export interface TabItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Match only the exact path (needed for "/"). */
  end?: boolean;
}

/** Tabs left of the central "+" action. */
export const TABS_BEFORE_ADD: readonly TabItem[] = [
  { to: '/', label: 'Início', icon: Home, end: true },
  { to: '/financial', label: 'Financeiro', icon: Wallet },
];

/** Tabs right of the central "+" action. */
export const TABS_AFTER_ADD: readonly TabItem[] = [
  { to: '/limits', label: 'Limites', icon: Percent },
  { to: MORE_ROUTE, label: 'Mais', icon: Menu },
];

/**
 * Whether a tab is the active one for the current path. The "Mais" tab also
 * covers the pages that live inside its menu.
 */
export function isTabActive(tab: TabItem, pathname: string): boolean {
  if (tab.to === MORE_ROUTE) return MORE_GROUP_ROUTES.includes(pathname);
  if (tab.end) return pathname === tab.to;
  return pathname === tab.to || pathname.startsWith(`${tab.to}/`);
}
