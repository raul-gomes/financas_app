import { Link, useLocation } from 'react-router';
import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TABS_AFTER_ADD, TABS_BEFORE_ADD, isTabActive, type TabItem } from './navigation';

interface MobileTabBarProps {
  /** Called when the central "+" button is pressed. */
  onAddTransaction: () => void;
}

function Tab({ tab, pathname }: { tab: TabItem; pathname: string }) {
  const active = isTabActive(tab, pathname);
  const Icon = tab.icon;
  return (
    <Link
      to={tab.to}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex min-h-[48px] min-w-[44px] flex-col items-center justify-center gap-0.5 text-[11px] transition-colors',
        active ? 'font-bold text-primary' : 'font-medium text-muted-foreground',
      )}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
      {tab.label}
    </Link>
  );
}

/**
 * Bottom tab bar for screens below `md`: four labelled tabs plus a raised
 * central "+" action. It is fixed to the viewport bottom and respects the
 * device safe area (home indicator).
 */
export function MobileTabBar({ onAddTransaction }: MobileTabBarProps) {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="grid grid-cols-5 items-start pt-1.5">
        {TABS_BEFORE_ADD.map((tab) => (
          <Tab key={tab.to} tab={tab} pathname={pathname} />
        ))}
        <div className="flex min-h-[48px] justify-center">
          <button
            type="button"
            aria-label="Nova transação"
            onClick={onAddTransaction}
            className="-mt-5 grid h-14 w-14 place-items-center rounded-[18px] bg-primary text-primary-foreground shadow-elegant transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Plus className="h-7 w-7" aria-hidden="true" />
          </button>
        </div>
        {TABS_AFTER_ADD.map((tab) => (
          <Tab key={tab.to} tab={tab} pathname={pathname} />
        ))}
      </div>
    </nav>
  );
}
