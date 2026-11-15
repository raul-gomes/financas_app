import { createContext } from 'react';

/** DOM node of the top bar's "month selector" slot (null until the bar mounts). */
export const MobileTopBarSlotContext = createContext<HTMLElement | null>(null);
