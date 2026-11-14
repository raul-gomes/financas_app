import { useEffect, useState } from 'react';

/**
 * Returns `value` only after it stopped changing for `delayMs`.
 * Used to turn keystrokes into one request instead of one per character.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
