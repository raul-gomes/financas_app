import { useContext } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router';
import { Logo } from '@/components/brand/Logo';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { MobileTopBarSlotContext } from './mobileTopBarContext';

/**
 * Renders its children inside the mobile top bar, between the title and the
 * notifications bell (e.g. a month selector). Renders nothing outside the app
 * shell. The slot lives in a `md:hidden` container, so on desktop pages must
 * keep their own inline control.
 */
export function MobileTopBarSlot({ children }: { children: React.ReactNode }) {
  const slot = useContext(MobileTopBarSlotContext);
  return slot ? createPortal(children, slot) : null;
}

interface MobileTopBarProps {
  /** Page title; `null` shows the Placo logo (home). */
  title: string | null;
  /** Receives the slot DOM node so the shell can expose it to pages. */
  slotRef: (node: HTMLDivElement | null) => void;
  /** Hide the bell where the page already offers notifications (the "Mais" menu). */
  showBell?: boolean;
}

/**
 * Top bar for screens below `md`: logo or page title, a slot for the month
 * selector and the notifications bell. Sticky, with the device top inset.
 */
export function MobileTopBar({ title, slotRef, showBell = true }: MobileTopBarProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card pt-[env(safe-area-inset-top)] md:hidden">
      <div className="flex min-h-14 items-center gap-2 px-4">
        {title === null ? (
          <Link to="/" aria-label="Placo, ir para o início" className="flex min-h-[44px] items-center">
            <Logo size="sm" />
          </Link>
        ) : (
          <p className="min-w-0 truncate text-xl font-bold text-foreground">{title}</p>
        )}
        <div ref={slotRef} className="ml-auto flex items-center" />
        {showBell && <NotificationBell compact />}
      </div>
    </header>
  );
}
